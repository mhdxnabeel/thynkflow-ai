from fastapi import FastAPI, HTTPException, Query, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
import google.generativeai as genai
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import requests
import re
import json
from json import JSONDecodeError
import logging
from collections import defaultdict
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
import hashlib
import secrets
import jwt

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Initialize Gemini
try:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment variables")
    
    genai.configure(api_key=api_key)
    logger.info("✅ Gemini API configured successfully")
except Exception as e:
    logger.error(f"❌ Gemini initialization error: {e}")
    raise

# Model fallback configuration
AVAILABLE_MODELS = [
    'gemini-2.5-pro',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash-8b-latest',
    'gemini-1.5-flash-8b-001',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro-001',
    'gemini-1.5-pro-002',
    'gemini-1.0-pro',
    'gemini-1.0-pro-latest',
    'gemini-1.0-pro-001',
    'gemini-ultra',
    'gemini-pro',
    'gemini-pro-vision',
]

def get_available_model() -> str:
    """Test and return the first working model"""
    logger.info("🔍 Testing available Gemini models...")
    
    for model_name in AVAILABLE_MODELS:
        try:
            test_model = genai.GenerativeModel(model_name)
            test_response = test_model.generate_content(
                "Hi", 
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=10,
                )
            )
            logger.info(f"✅ Model {model_name} is available and working!")
            return model_name
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "quota" in error_msg.lower():
                logger.warning(f"⚠️ Model {model_name}: Quota exceeded")
            elif "404" in error_msg or "not found" in error_msg.lower():
                logger.debug(f"⚠️ Model {model_name}: Not found")
            else:
                logger.debug(f"⚠️ Model {model_name}: {error_msg[:80]}")
            continue
    
    logger.error("❌ No working models found!")
    return 'gemini-2.5-pro'

WORKING_MODEL = get_available_model()

# Validate SERPAPI_KEY
SERPAPI_KEY = os.getenv("SERPAPI_KEY")
if not SERPAPI_KEY:
    logger.warning("⚠️ SERPAPI_KEY not found - trending topics will be disabled")
else:
    logger.info("✅ SERPAPI_KEY configured")

# ==================== FILE STORAGE SYSTEM ====================
STORAGE_BASE_DIR = Path("data/storage")
FEEDBACK_DIR = Path("data/feedback")
USERS_DIR = STORAGE_BASE_DIR / "users"
CHATS_DIR = STORAGE_BASE_DIR / "chats"

def ensure_directories():
    """Create storage directories if they don't exist"""
    STORAGE_BASE_DIR.mkdir(parents=True, exist_ok=True)
    FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)
    USERS_DIR.mkdir(parents=True, exist_ok=True)
    CHATS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"📁 Storage directory: {STORAGE_BASE_DIR.absolute()}")
    logger.info(f"📁 Feedback directory: {FEEDBACK_DIR.absolute()}")
    logger.info(f"📁 Users directory: {USERS_DIR.absolute()}")
    logger.info(f"📁 Chats directory: {CHATS_DIR.absolute()}")

ensure_directories()

# ==================== AUTHENTICATION HELPERS ====================
def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return hash_password(plain_password) == hashed_password

def generate_verification_code() -> str:
    """Generate 6-digit verification code"""
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])

def create_jwt_token(user_id: str, email: str) -> str:
    """Create JWT token"""
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> Dict[str, Any]:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Dependency to get current authenticated user"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        payload = decode_jwt_token(token)
        user_id = payload.get("user_id")
        
        # Load user from file
        user_file = USERS_DIR / f"{user_id}.json"
        if not user_file.exists():
            raise HTTPException(status_code=401, detail="User not found")
        
        with open(user_file, 'r', encoding='utf-8') as f:
            user = json.load(f)
        
        return user
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

# ==================== USER MANAGEMENT ====================
def save_user(user_data: dict):
    """Save user to file"""
    try:
        user_file = USERS_DIR / f"{user_data['user_id']}.json"
        with open(user_file, 'w', encoding='utf-8') as f:
            json.dump(user_data, f, indent=2, ensure_ascii=False)
        logger.info(f"💾 Saved user: {user_data['email']}")
        return True
    except Exception as e:
        logger.error(f"Error saving user: {e}")
        return False

def load_user_by_email(email: str) -> Optional[dict]:
    """Load user by email"""
    try:
        for user_file in USERS_DIR.glob("*.json"):
            with open(user_file, 'r', encoding='utf-8') as f:
                user = json.load(f)
                if user.get('email') == email:
                    return user
        return None
    except Exception as e:
        logger.error(f"Error loading user: {e}")
        return None

def load_user_by_id(user_id: str) -> Optional[dict]:
    """Load user by ID"""
    try:
        user_file = USERS_DIR / f"{user_id}.json"
        if not user_file.exists():
            return None
        
        with open(user_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading user: {e}")
        return None

# ==================== EMAIL FUNCTIONS ====================
def send_verification_email(email: str, name: str, code: str) -> bool:
    """Send email verification code"""
    try:
        smtp_host = os.getenv('SMTP_HOST')
        smtp_port = int(os.getenv('SMTP_PORT', 465))
        smtp_user = os.getenv('SMTP_USER')
        smtp_password = os.getenv('SMTP_PASSWORD')
        
        if not all([smtp_host, smtp_user, smtp_password]):
            logger.warning("⚠️ SMTP credentials not configured - skipping email")
            logger.info(f"🔐 VERIFICATION CODE for {email}: {code}")
            return False
        
        logger.info(f"📧 Attempting to send verification email to {email}")
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "Verify Your ThynkFlow AI Account"
        msg['From'] = f"ThynkFlow Team <{smtp_user}>"
        msg['To'] = email
        
        html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">ThynkFlow AI</h1>
                            <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px;">Intelligent Ideation Platform</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 24px;">Hi {name}! 👋</h2>
                            <p style="color: #374151; line-height: 1.7; margin: 0 0 30px 0;">Thank you for signing up with ThynkFlow AI! To complete your registration, please verify your email address using the code below:</p>
                            <div style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0;">
                                <p style="color: white; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Your Verification Code</p>
                                <p style="color: white; font-size: 42px; font-weight: bold; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">{code}</p>
                            </div>
                            <p style="color: #6b7280; font-size: 14px; margin: 20px 0; text-align: center;">This code will expire in 10 minutes</p>
                            <p style="color: #374151; line-height: 1.7; margin: 30px 0 0 0;">If you didn't create an account, please ignore this email.</p>
                             <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 25px;">
                                <p style="color: #374151; margin: 0;">Best regards,<br><strong>The ThynkFlow Team</strong></p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; background-color: #f9fafb; text-align: center; border-radius: 0 0 12px 12px;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">ThynkFlow AI © | System v1.0.4 | {datetime.now().year}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
        
        text = f"""
Hi {name},

Thank you for signing up with ThynkFlow AI!

Your verification code is: {code}

This code will expire in 10 minutes.

If you didn't create an account, please ignore this email.

Best regards,
The ThynkFlow Team
"""
        
        msg.attach(MIMEText(text, 'plain'))
        msg.attach(MIMEText(html, 'html'))
        
        # CRITICAL FIX: Use SMTP_SSL for port 465 (Gmail requires SSL, not STARTTLS)
        logger.info(f"🔌 Connecting to SMTP server {smtp_host}:{smtp_port} using SSL")
        
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30) as server:
            logger.info("🔌 Connected to SMTP server with SSL")
            server.login(smtp_user, smtp_password)
            logger.info("🔐 SMTP login successful")
            server.send_message(msg)
            logger.info(f"✅ Verification email sent to {email}")
        
        return True
        
    except smtplib.SMTPAuthenticationError as auth_err:
        logger.error(f"❌ SMTP Authentication failed: {auth_err}")
        logger.error(f"   Check SMTP_USER and SMTP_PASSWORD in .env")
        logger.error(f"   For Gmail, you MUST use an App Password")
        logger.info(f"🔐 VERIFICATION CODE (email failed): {code}")
        return False
        
    except Exception as e:
        logger.error(f"❌ Email error: {e}")
        logger.info(f"🔐 VERIFICATION CODE (email failed): {code}")
        return False


def send_reset_password_email(email: str, name: str, code: str) -> bool:
    """Send password reset code"""
    try:
        smtp_host = os.getenv('SMTP_HOST')
        smtp_port = int(os.getenv('SMTP_PORT', 465))
        smtp_user = os.getenv('SMTP_USER')
        smtp_password = os.getenv('SMTP_PASSWORD')
        
        if not all([smtp_host, smtp_user, smtp_password]):
            logger.warning("⚠️ SMTP credentials not configured - skipping email")
            logger.info(f"🔐 RESET CODE for {email}: {code}")
            return False
        
        logger.info(f"📧 Attempting to send reset email to {email}")
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "Reset Your ThynkFlow AI Password"
        msg['From'] = f"ThynkFlow Team <{smtp_user}>"
        msg['To'] = email
        
        html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">ThynkFlow AI</h1>
                            <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px;">Intelligent Ideation Platform</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 24px;">Password Reset Request</h2>
                            <p style="color: #374151; line-height: 1.7; margin: 0 0 30px 0;">Hi {name}, we received a request to reset your password. Use the code below to proceed:</p>
                            <div style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0;">
                                <p style="color: white; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Your Reset Code</p>
                                <p style="color: white; font-size: 42px; font-weight: bold; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">{code}</p>
                            </div>
                            <p style="color: #6b7280; font-size: 14px; margin: 20px 0; text-align: center;">This code will expire in 10 minutes</p>
                            <p style="color: #374151; line-height: 1.7; margin: 30px 0 0 0;">If you didn't request this, please ignore this email and your password will remain unchanged.</p>
                            <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 25px;">
                                <p style="color: #374151; margin: 0;">Best regards,<br><strong>The ThynkFlow Team</strong></p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; background-color: #f9fafb; text-align: center; border-radius: 0 0 12px 12px;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">ThynkFlow AI © | System v1.0.4 | {datetime.now().year}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
        
        text = f"""
Hi {name},

We received a request to reset your password.

Your reset code is: {code}

This code will expire in 10 minutes.

If you didn't request this, please ignore this email.

Best regards,
The ThynkFlow Team
"""
        
        msg.attach(MIMEText(text, 'plain'))
        msg.attach(MIMEText(html, 'html'))
        
        # CRITICAL FIX: Use SMTP_SSL for port 465 (Gmail requires SSL, not STARTTLS)
        logger.info(f"🔌 Connecting to SMTP server {smtp_host}:{smtp_port} using SSL")
        
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30) as server:
            logger.info("🔌 Connected to SMTP server with SSL")
            server.login(smtp_user, smtp_password)
            logger.info("🔐 SMTP login successful")
            server.send_message(msg)
            logger.info(f"✅ Reset email sent to {email}")
        
        return True
        
    except smtplib.SMTPAuthenticationError as auth_err:
        logger.error(f"❌ SMTP Authentication failed: {auth_err}")
        logger.error(f"   Check SMTP_USER and SMTP_PASSWORD in .env")
        logger.error(f"   For Gmail, you MUST use an App Password")
        logger.info(f"🔐 RESET CODE (email failed): {code}")
        return False
        
    except Exception as e:
        logger.error(f"❌ Email error: {e}")
        logger.info(f"🔐 RESET CODE (email failed): {code}")
        return False

# ==================== USER STORAGE HELPERS ====================
def get_user_directory(user_id: str) -> Path:
    """Get or create user chat directory"""
    user_dir = CHATS_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir

def get_chat_number(user_id: str) -> int:
    """Get the next chat number for a user"""
    user_dir = get_user_directory(user_id)
    existing_chats = list(user_dir.glob("Chat #*.json"))
    
    if not existing_chats:
        return 1
    
    numbers = []
    for chat_file in existing_chats:
        match = re.search(r'Chat #(\d+)', chat_file.name)
        if match:
            numbers.append(int(match.group(1)))
    
    return max(numbers) + 1 if numbers else 1

def generate_chat_filename(user_id: str, chat_number: int, created_at: datetime) -> str:
    """Generate chat filename"""
    date_str = created_at.strftime("%Y-%m-%d")
    time_str = created_at.strftime("%H-%M-%S")
    return f"Chat #{chat_number}, {date_str}, {time_str}.json"

def get_chat_filepath(user_id: str, session_id: str) -> Optional[Path]:
    """Find the chat file for a session"""
    user_dir = get_user_directory(user_id)
    
    for chat_file in user_dir.glob("Chat #*.json"):
        try:
            with open(chat_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if data.get('session_id') == session_id:
                    return chat_file
        except Exception as e:
            logger.error(f"Error reading {chat_file}: {e}")
            continue
    
    return None

def save_chat_session(session_data: dict):
    """Save or update a chat session"""
    try:
        user_id = session_data['user_id']
        session_id = session_data['session_id']
        
        chat_file = get_chat_filepath(user_id, session_id)
        
        if chat_file:
            with open(chat_file, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
            
            existing_data.update(session_data)
            
            with open(chat_file, 'w', encoding='utf-8') as f:
                json.dump(existing_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"💾 Updated chat: {chat_file.name}")
        else:
            user_dir = get_user_directory(user_id)
            chat_number = session_data.get('chat_number', get_chat_number(user_id))
            created_at = datetime.fromisoformat(session_data['created_at'])
            filename = generate_chat_filename(user_id, chat_number, created_at)
            chat_file = user_dir / filename
            
            session_data['chat_number'] = chat_number
            
            with open(chat_file, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"💾 Created new chat: {filename}")
        
        return True
    except Exception as e:
        logger.error(f"❌ Error saving chat session: {e}")
        return False

def load_chat_session(user_id: str, session_id: str) -> Optional[dict]:
    """Load a chat session"""
    try:
        chat_file = get_chat_filepath(user_id, session_id)
        if not chat_file or not chat_file.exists():
            return None
        
        with open(chat_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return data
    except Exception as e:
        logger.error(f"❌ Error loading chat session: {e}")
        return None

def get_user_sessions(user_id: str) -> List[dict]:
    """Get all sessions for a user"""
    try:
        user_dir = get_user_directory(user_id)
        sessions = []
        
        for chat_file in sorted(user_dir.glob("Chat #*.json"), reverse=True):
            try:
                with open(chat_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                sessions.append({
                    'session_id': data.get('session_id'),
                    'title': data.get('title', chat_file.stem),
                    'user_id': user_id,
                    'created_at': data.get('created_at'),
                    'updated_at': data.get('updated_at'),
                    'prompt_type': data.get('prompt_type', 'conversation'),
                    'message_count': len(data.get('messages', []))
                })
            except Exception as e:
                logger.error(f"Error reading {chat_file}: {e}")
                continue
        
        return sessions
    except Exception as e:
        logger.error(f"❌ Error getting user sessions: {e}")
        return []

def delete_chat_session(user_id: str, session_id: str):
    """Delete a chat session"""
    try:
        chat_file = get_chat_filepath(user_id, session_id)
        if chat_file and chat_file.exists():
            chat_file.unlink()
            logger.info(f"🗑️ Deleted chat: {chat_file.name}")
            
            if session_id in active_chat_objects:
                del active_chat_objects[session_id]
            
            return True
        return False
    except Exception as e:
        logger.error(f"❌ Error deleting chat session: {e}")
        return False

def add_message_to_session(user_id: str, session_id: str, message_data: dict):
    """Add a message to a chat session"""
    try:
        session_data = load_chat_session(user_id, session_id)
        if not session_data:
            logger.error(f"Session not found: {session_id}")
            return False
        
        if 'messages' not in session_data:
            session_data['messages'] = []
        
        session_data['messages'].append(message_data)
        session_data['updated_at'] = datetime.now().isoformat()
        
        save_chat_session(session_data)
        return True
    except Exception as e:
        logger.error(f"❌ Error adding message: {e}")
        return False

# ==================== IN-MEMORY STORAGE ====================
active_chat_objects = {}
failed_models = defaultdict(set)
verification_codes = {}  # email -> {'code': str, 'expires': datetime, 'user_data': dict}
reset_codes = {}  # email -> {'code': str, 'expires': datetime}

# ==================== MODELS ====================
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class ChatRequest(BaseModel):
    message: str
    session_id: str
    user_id: Optional[str] = None
    mode: Optional[str] = "auto"

class NewSessionRequest(BaseModel):
    user_id: Optional[str] = None
    title: Optional[str] = None

class UpdateTitleRequest(BaseModel):
    title: str

class FeedbackRequest(BaseModel):
    type: str
    message: str

class UpdateNameRequest(BaseModel):
    name: str

# ==================== HELPER FUNCTIONS (keeping existing ones) ====================
def classify_prompt(message: str) -> str:
    """Classify if the prompt is for ideation or normal conversation"""
    strong_ideation_keywords = [
        'brainstorm', 'idea', 'ideas', 'startup', 'business ideas',
        'mind map', 'mindmap', 'campaign ideas', 'marketing ideas',
        'generate ideas', 'suggest ideas', 'give me ideas'
    ]
    
    moderate_ideation_keywords = [
        'suggest', 'help me create', 'how can i build', 'how to start',
        'marketing plan', 'business plan', 'strategy for', 'launch',
        'come up with', 'think of some', 'give me some'
    ]
    
    question_indicators = [
        'what is', 'who is', 'when did', 'where is', 'why does',
        'how does', 'explain', 'tell me about', 'what are the',
        'define', 'meaning of', 'difference between'
    ]
    
    message_lower = message.lower()
    
    for indicator in question_indicators:
        if indicator in message_lower:
            return 'conversation'
    
    for keyword in strong_ideation_keywords:
        if keyword in message_lower:
            return 'ideation'
    
    for keyword in moderate_ideation_keywords:
        if keyword in message_lower:
            if any(word in message_lower for word in ['5', 'ten', 'several', 'multiple', 'some', 'few']):
                return 'ideation'
            if any(word in message_lower for word in ['create', 'build', 'develop', 'design', 'make']):
                return 'ideation'
    
    return 'conversation'

def create_model_for_session(prompt_type: str, session_id: str = None, user_name: str = None):
    """Create a Gemini model with appropriate system instructions"""
    
    # Add user name greeting if available
    user_greeting = f" When responding, you can address the user as {user_name}." if user_name else ""
    
    if prompt_type == 'ideation':
        system_instruction = f"""You are ThynkFlow AI, an expert ideation and innovation assistant.{user_greeting}

CORE CAPABILITIES:
- Generate creative, innovative, and actionable ideas
- Provide structured brainstorming with clear formatting
- Score ideas objectively on novelty, feasibility, and market alignment
- Suggest trending topics and market opportunities

RESPONSE FORMAT FOR IDEATION:
When generating multiple ideas, ALWAYS use this format:

## Idea 1: [Clear, Concise Title]
[Detailed description of the idea, including:]
- **Problem Addressed:** What problem does this solve?
- **Innovation:** What makes this unique?
- **Target Audience:** Who is this for?
- **Implementation:** How would this work?
- **Market Opportunity:** Why is this valuable?

## Idea 2: [Clear, Concise Title]
[Continue same structure...]

IMPORTANT RULES:
1. Each idea MUST start with "## Idea [number]: [Title]"
2. Titles should be 3-8 words, descriptive and specific
3. Separate each idea with blank lines
4. Provide 5-10 ideas when requested
5. Be creative but practical
6. Consider current trends and market needs"""
    else:
        system_instruction = f"""You are ThynkFlow AI, a helpful, friendly, and knowledgeable assistant.{user_greeting}
        
Provide clear, accurate, and helpful responses to user questions."""
    
    models_to_try = AVAILABLE_MODELS.copy()
    if session_id and session_id in failed_models:
        models_to_try = [m for m in models_to_try if m not in failed_models[session_id]]
    
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name, system_instruction=system_instruction)
            logger.info(f"✅ Using model: {model_name}")
            return model
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "quota" in error_msg.lower():
                logger.warning(f"⚠️ {model_name}: Quota exceeded")
                if session_id:
                    failed_models[session_id].add(model_name)
            continue
    
    if session_id:
        failed_models[session_id].clear()
    
    try:
        logger.warning(f"⚠️ Using fallback model: {WORKING_MODEL}")
        return genai.GenerativeModel(WORKING_MODEL, system_instruction=system_instruction)
    except Exception as e:
        raise Exception(f"Unable to initialize any Gemini model: {str(e)}")

def get_any_working_model(system_instruction: str = None):
    """
    Return a Gemini model using the WORKING_MODEL selected at startup.
    We don't probe all models again here – that was causing
    'No Gemini models are currently available' during scoring.
    """
    logger.info(f"🔄 Using pre-selected working model: {WORKING_MODEL}")
    try:
        if system_instruction:
            return genai.GenerativeModel(WORKING_MODEL, system_instruction=system_instruction)
        else:
            return genai.GenerativeModel(WORKING_MODEL)
    except Exception as e:
        logger.error(f"❌ Could not initialize Gemini model {WORKING_MODEL}: {e}")
        # score_idea will catch this and fall back, but now if this happens
        # it means your API key or quota is really broken.
        raise Exception("No Gemini models are currently available")

def generate_and_score_ideas(user_query: str, num_ideas: int = 5):
    """
    One-shot idea generation + scoring.
    Avoids rate limits (only 1 Gemini call).
    """
    model = genai.GenerativeModel(WORKING_MODEL)

    prompt = f"""
Generate EXACTLY {num_ideas} startup ideas based on this query:

{user_query}

For EACH IDEA return the following JSON structure:

[
  {{
    "id": 1,
    "title": "short title",
    "description": "2–4 sentence description",
    "scores": {{
      "novelty": <0-100>,
      "feasibility": <0-100>,
      "market_alignment": <0-100>
    }},
    "reasoning": {{
      "novelty": "1 sentence",
      "feasibility": "1 sentence",
      "market_alignment": "1 sentence"
    }}
  }}
]

Return ONLY valid JSON. No markdown, no commentary.
"""

    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            max_output_tokens=900,
            temperature=0.75
        ),
    )

    raw = (response.text or "").strip()

    # remove ```json fences if present
    if "```" in raw:
        raw = raw.split("```")[-2]

    try:
        return json.loads(raw)
    except:
        logger.error("JSON parse failed in generate_and_score_ideas()")
        return []


def extract_idea_title(idea_text: str, idea_number: int = 1) -> str:
    if not idea_text or len(idea_text.strip()) < 10:
        return f"Idea {idea_number}"
    
    clean_text = idea_text.replace('**', '').replace('*', '').strip()
    lines = [line.strip() for line in clean_text.split('\n') if line.strip()]
    
    if not lines:
        return f"Idea {idea_number}"
    
    # Pattern 1: Look for "## Idea X: Title" format
    if lines[0]:
        header_match = re.match(r'^##\s*Idea\s+\d+:\s*(.+)$', lines[0], re.IGNORECASE)
        if header_match:
            title = header_match.group(1).strip()
            if 5 <= len(title) <= 100:
                return title
    
    # Pattern 2: Look for "Idea X: Title" without ##
    if lines[0]:
        simple_match = re.match(r'^Idea\s+\d+:\s*(.+)$', lines[0], re.IGNORECASE)
        if simple_match:
            title = simple_match.group(1).strip()
            if 5 <= len(title) <= 100:
                return title
    
    # Pattern 3: First line if it looks like a title (short and no colons except at end)
    first_line = lines[0].strip('*-•#. ')
    if 5 <= len(first_line) <= 80 and first_line.count(':') <= 1:
        # Remove leading numbers
        first_line = re.sub(r'^\d+[.)]\s*', '', first_line)
        if 5 <= len(first_line) <= 80:
            return first_line
    
    # Pattern 4: Look for title in the format "Title: ..." or "**Title:**"
    for line in lines[:3]:
        if ':' in line:
            parts = line.split(':', 1)
            potential_title = parts[0].strip('*-•#. ')
            # Skip if it's a label like "Problem:", "Solution:", etc.
            if potential_title.lower() not in ['problem', 'solution', 'innovation', 'target audience', 
                                              'implementation', 'market opportunity', 'concept', 
                                              'description', 'overview', 'features']:
                if 5 <= len(potential_title) <= 80:
                    return potential_title
    
    # Fallback: Use first meaningful sentence
    for line in lines[:5]:
        line_clean = re.sub(r'^[-*•#]\s*', '', line)
        line_clean = re.sub(r'^\d+[.)]\s*', '', line_clean)
        line_clean = line_clean.strip()
        
        if len(line_clean) >= 10 and ':' not in line_clean[:30]:
            words = line_clean.split()[:12]
            title = ' '.join(words)
            if len(title) > 80:
                title = title[:77] + "..."
            return title
    
    return f"Idea {idea_number}"


def extract_ideas_from_response(response_text: str, num_requested: int) -> List[Dict[str, str]]:
    """
    Parse the model response and extract each idea with a clean title and content.

    Expected pattern in the response:
      ## Idea 1: Awesome Product Name
      ... paragraphs ...

      ## Idea 2: Another Idea
      ... paragraphs ...
    """

    ideas: List[Dict[str, str]] = []

    # Pattern: "## Idea X: Title"
    heading_pattern = re.compile(
        r"^##\s*Idea\s*(\d+)\s*[:\-]\s*(.+)$",
        re.IGNORECASE | re.MULTILINE,
    )

    matches = list(heading_pattern.finditer(response_text))

    if not matches:
        # Fallback: treat whole response as one idea
        cleaned = response_text.strip()
        return [{
            "number": 1,
            "extracted_title": "Idea 1",
            "content": cleaned,
        }]

    for idx, match in enumerate(matches):
        raw_idea_number = match.group(1)
        raw_title = match.group(2)

        # use sequential index as idea number (1,2,3,...) so UI is consistent
        idea_number = idx + 1

        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(response_text)
        body = response_text[start:end].strip()

        # --- clean up the title ---
        title = raw_title.strip()
        # remove markdown markers
        title = re.sub(r"[*#`]", "", title).strip()
        # remove trailing colon
        if title.endswith(":"):
            title = title[:-1].strip()
        # truncate very long titles
        if len(title) > 80:
            title = title[:77] + "..."

        if not title:
            title = f"Idea {idea_number}"

        ideas.append({
            "number": idea_number,
            "extracted_title": title,
            "content": body,
        })

    # Respect requested count
    if num_requested and num_requested > 0:
        ideas = ideas[:num_requested]

    return ideas
def clean_query(q: str) -> str:
    """Normalize a query string for trend lookups."""
    if not q:
        return ""
    # collapse repeated spaces and trim
    return " ".join(q.strip().split())


def clean_query(query: str) -> str:
    """Simple cleaner for trend search queries."""
    q = (query or "").strip()
    # remove extra punctuation and limit length
    q = re.sub(r"[\n\r\t]", " ", q)
    q = re.sub(r"\s+", " ", q)
    return q[:120]



def get_trending_topics(query: str) -> List[str]:
    try:
        if not SERPAPI_KEY:
            logger.warning("⚠️ SERPAPI_KEY not configured")
            return []
        
        search_query = clean_query(query)
        if not search_query:
            return []
        
        logger.info(f"🔍 Searching trends for: '{search_query}'")
        
        # Basic SerpAPI Google Trends call
        url = "https://serpapi.com/search.json"
        s = {
            "engine": "google_trends",
            "q": search_query,
            "api_key": SERPAPI_KEY,
        }
        
        response = requests.get(url, params=s, timeout=15)
        logger.info(f"📊 Trends API Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            trends: List[str] = []
            
            # Try rising queries first if present
            related = data.get("related_queries") or {}
            if "rising" in related:
                rising = related["rising"]
                for item in rising[:5]:
                    if isinstance(item, dict) and "query" in item:
                        trends.append(item["query"])
                        logger.info(f"  ↗️ Rising: {item['query']}")
            
            # Fallback to top queries
            if not trends and "top" in related:
                top = related["top"]
                for item in top[:5]:
                    if isinstance(item, dict) and "query" in item:
                        trends.append(item["query"])
            
            if trends:
                logger.info(f"✅ Found {len(trends)} trending topics")
            else:
                logger.warning("⚠️ No trends found in response")
            
            return trends
        
        logger.error(f"❌ Trends API error: {response.status_code}")
        return []
    
    except requests.Timeout:
        logger.error("❌ Trends API timeout")
        return []
    except Exception as e:
        logger.error(f"❌ Trends error: {e}")
        return []

def score_idea(idea_data: Dict[str, str], user_query: str) -> Dict[str, Any]:
    """
    Score an individual idea using a local heuristic (no Gemini calls).
    This avoids quota issues and still gives varied, meaningful-looking scores.
    """
    idea_number = idea_data.get("number", 1)
    idea_text = idea_data.get("content", "") or ""
    idea_title = (idea_data.get("extracted_title") or "").strip()

    if not idea_title or idea_title == f"Idea {idea_number}" or len(idea_title) < 5:
        idea_title = extract_idea_title(idea_text, idea_number)

    if len(idea_title) > 80:
        idea_title = idea_title[:77] + "."

    logger.info(f"📊 [LOCAL] Scoring idea #{idea_number}: {idea_title}")

    text_lower = idea_text.lower()

    # --- basic text features ---
    length = len(idea_text)
    words = re.findall(r"\w+", text_lower)
    unique_words = len(set(words)) if words else 0
    sentence_count = max(1, idea_text.count(".") + idea_text.count("!") + idea_text.count("?"))

    # keyword buckets
    novelty_keywords = [
        "ai", "machine learning", "blockchain", "web3", "automation", "autonomous",
        "generative", "llm", "augmented reality", "virtual reality", "vr", "ar",
        "multimodal", "agent", "agents"
    ]
    feasibility_risk_keywords = [
        "quantum", "fusion", "teleportation", "brain upload", "time travel"
    ]
    market_keywords = [
        "market", "customers", "users", "revenue", "pricing", "subscription",
        "b2b", "b2c", "enterprise", "startup", "growth", "scalable", "sas", "saas"
    ]

    novelty_hits = sum(1 for k in novelty_keywords if k in text_lower)
    risk_hits = sum(1 for k in feasibility_risk_keywords if k in text_lower)
    market_hits = sum(1 for k in market_keywords if k in text_lower)

    # --- novelty heuristic (0–100) ---
    novelty = 40 + unique_words * 0.3 + novelty_hits * 8
    novelty = max(20, min(95, novelty))

    # --- feasibility heuristic (0–100) ---
    base_feasibility = 60 + (sentence_count - 3) * 3
    base_feasibility -= risk_hits * 15
    # very short ideas are less feasible (not thought-through)
    if length < 300:
        base_feasibility -= 10
    feasibility = max(15, min(95, base_feasibility))

    # --- market alignment heuristic (0–100) ---
    market_alignment = 45 + market_hits * 7
    if any(word in text_lower for word in ["problem", "pain point", "customer", "target audience", "niche"]):
        market_alignment += 8
    if "business" in text_lower or "startup" in text_lower:
        market_alignment += 5
    market_alignment = max(20, min(95, market_alignment))

    # --- overall score ---
    overall = round(novelty * 0.3 + feasibility * 0.4 + market_alignment * 0.3, 1)

    reasoning = {
        "novelty": (
            "The idea uses several innovative or trending concepts."
            if novelty_hits > 0 else
            "The idea is moderately novel but uses mostly familiar concepts."
        ),
        "feasibility": (
            "The idea appears realistic and implementable with current technology."
            if feasibility >= 60 else
            "The idea may be challenging to implement or under-specified."
        ),
        "market_alignment": (
            "The idea clearly references customers, markets, or business value."
            if market_hits > 0 else
            "The idea could benefit from a clearer market focus and value proposition."
        ),
    }

    result = {
        "novelty": round(novelty, 1),
        "feasibility": round(feasibility, 1),
        "market_alignment": round(market_alignment, 1),
        "overall": overall,
        "reasoning": reasoning,
        "idea_number": idea_number,
        "idea_title": idea_title,
        "idea_text": idea_text,
    }

    logger.info(f"✅ [LOCAL] Final scores for idea #{idea_number}: {result}")
    return result


    # ---------- helper: safe defaults ----------
    def _fallback(reason: str) -> Dict[str, Any]:
        logger.error(f"❌ Scoring error for idea #{idea_number}: {reason}")
        return {
            "novelty": 50.0,
            "feasibility": 50.0,
            "market_alignment": 50.0,
            "overall": 50.0,
            "reasoning": {
                "novelty": "Scoring failed",
                "feasibility": "Scoring failed",
                "market_alignment": "Scoring failed",
            },
            "idea_number": idea_number,
            "idea_title": idea_title,
            "idea_text": idea_text,
        }

    try:
        scoring_prompt = f"""
You are an expert innovation analyst. Analyze this idea and return a STRICT JSON object.

USER QUESTION: {user_query}

IDEA #{idea_number} TO SCORE:
Title: {idea_title}
Content: {idea_text}

Return a SINGLE JSON object in this exact form, no markdown, no backticks, no extra text:

{{
  "novelty": <number 0-100>,
  "feasibility": <number 0-100>,
  "market_alignment": <number 0-100>,
  "reasoning": {{
    "novelty": "1-2 sentence explanation",
    "feasibility": "1-2 sentence explanation",
    "market_alignment": "1-2 sentence explanation"
  }}
}}
"""

        model = get_any_working_model()
        response = model.generate_content(
            scoring_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                max_output_tokens=300,
            ),
        )

        response_text = (getattr(response, "text", None) or "").strip()
        logger.info(
            f"📊 Raw scoring response for idea #{idea_number}: {response_text[:400]}"
        )

        # ---------- 1) strip markdown fences ----------
        if "```" in response_text:
            lower = response_text.lower()
            if "```json" in lower:
                parts = response_text.split("```json", 1)
                rest = parts[1] if len(parts) > 1 else parts[0]
                response_text = rest.split("```", 1)[0].strip()
            else:
                parts = response_text.split("```", 1)
                if len(parts) > 1:
                    rest = parts[1]
                    response_text = rest.split("```", 1)[0].strip()

        # ---------- 2) try to isolate JSON block ----------
        # First try: biggest {...} block
        if "{" in response_text and "}" in response_text:
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            candidate = response_text[start:end].strip()
        else:
            candidate = response_text

        logger.info(
            f"📊 JSON candidate for idea #{idea_number}: {candidate[:400]}"
        )

        # ---------- 3) parse JSON, with fallbacks ----------
        scores: Dict[str, Any] = {}

        try:
            scores = json.loads(candidate)
        except JSONDecodeError:
            # Try to salvage data with regex if the model didn't give clean JSON
            logger.warning(
                f"⚠️ JSON decode failed for idea #{idea_number}, "
                f"attempting regex extraction."
            )
            for key in ["novelty", "feasibility", "market_alignment"]:
                m = re.search(
                    rf'"?{key}"?\s*:\s*([0-9]+(?:\.[0-9]+)?)',
                    candidate,
                    flags=re.IGNORECASE,
                )
                if m:
                    scores[key] = float(m.group(1))

            # build minimal reasoning if model gave some explanation
            if "reason" in candidate.lower():
                scores.setdefault(
                    "reasoning",
                    {
                        "novelty": "Automatically extracted from model output.",
                        "feasibility": "Automatically extracted from model output.",
                        "market_alignment": "Automatically extracted from model output.",
                    },
                )

        if not scores:
            # Still nothing usable
            return _fallback("No scores could be extracted from model output.")

        # ---------- 4) normalize and clamp numbers ----------
        def _get_score(key: str) -> float:
            try:
                v = float(scores.get(key, 50))
            except (TypeError, ValueError):
                v = 50.0
            # clamp 0–100
            return max(0.0, min(100.0, v))

        novelty = _get_score("novelty")
        feasibility = _get_score("feasibility")
        market_alignment = _get_score("market_alignment")

        overall = round(
            novelty * 0.3 + feasibility * 0.4 + market_alignment * 0.3, 1
        )

        reasoning = scores.get("reasoning") or {
            "novelty": "No detailed reasoning provided.",
            "feasibility": "No detailed reasoning provided.",
            "market_alignment": "No detailed reasoning provided.",
        }

        result = {
            "novelty": novelty,
            "feasibility": feasibility,
            "market_alignment": market_alignment,
            "overall": overall,
            "reasoning": reasoning,
            "idea_number": idea_number,
            "idea_title": idea_title,
            "idea_text": idea_text,
        }

        logger.info(f"✅ Final scores for idea #{idea_number}: {result}")
        return result

    except Exception as e:
        return _fallback(f"Unexpected exception: {e}")


# ==================== FEEDBACK FUNCTIONS ====================
def send_feedback_email(feedback_data: dict) -> bool:
    """Send thank you email for feedback - FIXED VERSION WITH SSL"""
    try:
        # Get SMTP configuration
        smtp_host = os.getenv('SMTP_HOST')
        smtp_port = int(os.getenv('SMTP_PORT', 465))
        smtp_user = os.getenv('SMTP_USER')
        smtp_password = os.getenv('SMTP_PASSWORD')
        
        # Validate credentials
        if not all([smtp_host, smtp_user, smtp_password]):
            logger.warning("⚠️ SMTP credentials not configured for feedback email")
            logger.info(f"📝 Feedback saved but email not sent (no SMTP config)")
            return False
        
        user_email = feedback_data.get('user_email')
        user_name = feedback_data.get('user_name', 'User')
        
        if not user_email:
            logger.error("❌ No email address provided in feedback data")
            return False
        
        # Feedback type labels
        feedback_type_labels = {
            'bug': 'Bug Report',
            'feature': 'Feature Request',
            'other': 'Feedback'
        }
        feedback_type_label = feedback_type_labels.get(feedback_data['type'], 'Feedback')
        
        logger.info(f"📧 Preparing to send feedback email to {user_email}")
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"Thank you for your {feedback_type_label}!"
        msg['From'] = f"ThynkFlow Team <{smtp_user}>"
        msg['To'] = user_email
        
        # HTML content
        html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">ThynkFlow AI</h1>
                            <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px;">Intelligent Ideation Platform</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 24px;">Hi {user_name}! 👋</h2>
                            <p style="color: #374151; line-height: 1.7; margin: 0 0 20px 0;">Thank you for your {feedback_type_label.lower()}. We appreciate your feedback and will review it carefully!</p>
                            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #9333ea; margin: 20px 0;">
                                <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; font-weight: 600;">Your Feedback</p>
                                <p style="color: #111827; margin: 0; white-space: pre-wrap; line-height: 1.6;">{feedback_data['message']}</p>
                            </div>
                            <p style="color: #374151; line-height: 1.7; margin: 20px 0 0 0;">We're constantly working to improve ThynkFlow AI based on user feedback like yours. Thank you for helping us build a better product!</p>
                            <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 25px;">
                                <p style="color: #374151; margin: 0;">Best regards,<br><strong>The ThynkFlow Team</strong></p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; background-color: #f9fafb; text-align: center; border-radius: 0 0 12px 12px;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">ThynkFlow AI © | System v1.0.4 | {datetime.now().year}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
        
        # Plain text version
        text = f"""
Hi {user_name},

Thank you for your {feedback_type_label.lower()}. We appreciate your feedback!

Your message:
{feedback_data['message']}

We're constantly working to improve ThynkFlow AI based on user feedback like yours.

Best regards,
The ThynkFlow Team
"""
        
        msg.attach(MIMEText(text, 'plain'))
        msg.attach(MIMEText(html, 'html'))
        
        # CRITICAL FIX: Use SMTP_SSL for port 465 (Gmail requires SSL, not STARTTLS)
        logger.info(f"🔌 Connecting to SMTP server {smtp_host}:{smtp_port} using SSL")
        
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30) as server:
            logger.info("🔌 Connected to SMTP server with SSL")
            server.login(smtp_user, smtp_password)
            logger.info("🔐 SMTP login successful")
            server.send_message(msg)
            logger.info(f"✅ Feedback email sent successfully to {user_email}")
        
        return True
        
    except smtplib.SMTPAuthenticationError as auth_err:
        logger.error(f"❌ SMTP Authentication failed: {auth_err}")
        logger.error(f"   Check SMTP_USER and SMTP_PASSWORD in .env")
        logger.error(f"   For Gmail, you MUST use an App Password")
        return False
        
    except smtplib.SMTPException as smtp_err:
        logger.error(f"❌ SMTP error: {smtp_err}")
        return False
        
    except Exception as e:
        logger.error(f"❌ Feedback email error: {e}")
        import traceback
        logger.error(f"   Traceback: {traceback.format_exc()}")
        return False

def save_feedback(feedback_data: dict):
    """Save feedback to JSON file"""
    try:
        file_path = FEEDBACK_DIR / 'feedback.json'
        
        feedbacks = []
        
        if file_path.exists():
            try:
                if file_path.stat().st_size > 0:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read().strip()
                        if content:
                            feedbacks = json.loads(content)
                        else:
                            feedbacks = []
                else:
                    feedbacks = []
            except json.JSONDecodeError:
                backup_path = FEEDBACK_DIR / f'feedback_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
                try:
                    file_path.rename(backup_path)
                    logger.info(f"📦 Backed up corrupted file")
                except:
                    pass
                feedbacks = []
        
        if not isinstance(feedbacks, list):
            feedbacks = []
        
        feedback_data['timestamp'] = datetime.now().isoformat()
        feedback_data['id'] = f"feedback_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        feedbacks.append(feedback_data)
        
        temp_path = FEEDBACK_DIR / 'feedback_temp.json'
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(feedbacks, f, indent=2, ensure_ascii=False)
        
        temp_path.replace(file_path)
        
        logger.info(f"💾 Feedback saved successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error saving feedback: {e}")
        return False

# ==================== AUTHENTICATION ENDPOINTS ====================
@app.post("/auth/signup")
async def signup(request: SignupRequest):
    """Register new user and send verification code"""
    try:
        # Check if user exists
        existing_user = load_user_by_email(request.email)
        if existing_user and existing_user.get('verified'):
            raise HTTPException(status_code=400, detail="User already exists")
        
        # Generate user ID and verification code
        user_id = f"user_{datetime.now().strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(4)}"
        code = generate_verification_code()
        
        # Store verification code (expires in 10 minutes)
        verification_codes[request.email] = {
            'code': code,
            'expires': datetime.now() + timedelta(minutes=10),
            'user_data': {
                'user_id': user_id,
                'name': request.name,
                'email': request.email,
                'password': hash_password(request.password),
                'verified': False,
                'created_at': datetime.now().isoformat()
            }
        }
        
        # Log the code for server logs only
        logger.info(f"🔐 Generated verification code for {request.email}: {code}")
        
        # Send verification email
        email_sent = send_verification_email(request.email, request.name, code)
        
        # Always return success without exposing the code
        return {
            "success": True,
            "message": "Verification code sent to your email. Please check your inbox."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/auth/verify-email")
async def verify_email(request: VerifyEmailRequest):
    """Verify email with code"""
    try:
        # Check if code exists
        if request.email not in verification_codes:
            raise HTTPException(status_code=400, detail="Invalid or expired code")
        
        verification_data = verification_codes[request.email]
        
        # Check expiration
        if datetime.now() > verification_data['expires']:
            del verification_codes[request.email]
            raise HTTPException(status_code=400, detail="Code expired")
        
        # Verify code
        if request.code != verification_data['code']:
            raise HTTPException(status_code=400, detail="Invalid code")
        
        # Save user
        user_data = verification_data['user_data']
        user_data['verified'] = True
        save_user(user_data)
        
        # Create JWT token
        token = create_jwt_token(user_data['user_id'], user_data['email'])
        
        # Clean up verification code
        del verification_codes[request.email]
        
        return {
            "success": True,
            "message": "Email verified successfully",
            "token": token,
            "user": {
                "user_id": user_data['user_id'],
                "name": user_data['name'],
                "email": user_data['email']
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/login")
async def login(request: LoginRequest):
    """Login user"""
    try:
        # Load user
        user = load_user_by_email(request.email)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Check if verified
        if not user.get('verified'):
            raise HTTPException(status_code=401, detail="Email not verified")
        
        # Verify password
        if not verify_password(request.password, user['password']):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Create JWT token
        token = create_jwt_token(user['user_id'], user['email'])
        
        return {
            "success": True,
            "message": "Login successful",
            "token": token,
            "user": {
                "user_id": user['user_id'],
                "name": user['name'],
                "email": user['email']
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Send password reset code"""
    try:
        # Load user
        user = load_user_by_email(request.email)
        if not user:
            # Don't reveal if email exists - still return success
            return {
                "success": True,
                "message": "If the email exists, a reset code has been sent"
            }
        
        # Generate reset code
        code = generate_verification_code()
        
        # Store reset code (expires in 10 minutes)
        reset_codes[request.email] = {
            'code': code,
            'expires': datetime.now() + timedelta(minutes=10)
        }
        
        # Log the code for server logs only
        logger.info(f"🔐 Generated reset code for {request.email}: {code}")
        
        # Send reset email
        email_sent = send_reset_password_email(request.email, user['name'], code)
        
        return {
            "success": True,
            "message": "Reset code sent to your email. Please check your inbox."
        }
        
    except Exception as e:
        logger.error(f"Forgot password error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password with code"""
    try:
        # Check if code exists
        if request.email not in reset_codes:
            raise HTTPException(status_code=400, detail="Invalid or expired code")
        
        reset_data = reset_codes[request.email]
        
        # Check expiration
        if datetime.now() > reset_data['expires']:
            del reset_codes[request.email]
            raise HTTPException(status_code=400, detail="Code expired")
        
        # Verify code
        if request.code != reset_data['code']:
            raise HTTPException(status_code=400, detail="Invalid code")
        
        # Load user and update password
        user = load_user_by_email(request.email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user['password'] = hash_password(request.new_password)
        save_user(user)
        
        # Clean up reset code
        del reset_codes[request.email]
        
        return {
            "success": True,
            "message": "Password reset successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/auth/resend-verification")
async def resend_verification(request: VerifyEmailRequest):
    """Resend verification code"""
    try:
        # Check if there's a pending verification for this email
        if request.email not in verification_codes:
            raise HTTPException(status_code=400, detail="No pending verification found. Please sign up first.")
        
        verification_data = verification_codes[request.email]
        
        # Generate new code
        new_code = generate_verification_code()
        
        # Update the verification code and expiration
        verification_data['code'] = new_code
        verification_data['expires'] = datetime.now() + timedelta(minutes=10)
        
        # Get user data
        user_data = verification_data['user_data']
        
        # Log the code for server logs only
        logger.info(f"🔐 Regenerated verification code for {request.email}: {new_code}")
        
        # Send verification email
        email_sent = send_verification_email(request.email, user_data['name'], new_code)
        
        # Always return success without exposing the code
        return {
            "success": True,
            "message": "New verification code sent to your email. Please check your inbox."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resend verification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return {
        "user_id": current_user['user_id'],
        "name": current_user['name'],
        "email": current_user['email'],
        "created_at": current_user.get('created_at')
    }

@app.post("/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user (client should remove token)"""
    return {
        "success": True,
        "message": "Logged out successfully"
    }

@app.put("/auth/update-name")
async def update_name(request: UpdateNameRequest, current_user: dict = Depends(get_current_user)):
    """Update user's name"""
    try:
        if not request.name or not request.name.strip():
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        
        # Load and update user
        user = load_user_by_id(current_user['user_id'])
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user['name'] = request.name.strip()
        save_user(user)
        
        logger.info(f"✅ Updated name for user {current_user['email']}")
        
        return {
            "success": True,
            "message": "Name updated successfully",
            "user": {
                "user_id": user['user_id'],
                "name": user['name'],
                "email": user['email']
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update name error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/auth/delete-account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    """Delete user account and all associated data"""
    try:
        user_id = current_user['user_id']
        email = current_user['email']
        
        logger.info(f"🗑️ Deleting account for user: {email}")
        
        # Delete user file
        user_file = USERS_DIR / f"{user_id}.json"
        if user_file.exists():
            user_file.unlink()
            logger.info(f"✅ Deleted user file: {user_id}")
        
        # Delete all user's chat sessions
        user_chat_dir = CHATS_DIR / user_id
        if user_chat_dir.exists():
            import shutil
            shutil.rmtree(user_chat_dir)
            logger.info(f"✅ Deleted user chats directory: {user_id}")
        
        # Clean up any active chat objects for this user
        sessions_to_remove = []
        for session_id in active_chat_objects.keys():
            if session_id.startswith(user_id):
                sessions_to_remove.append(session_id)
        
        for session_id in sessions_to_remove:
            del active_chat_objects[session_id]
        
        logger.info(f"✅ Account deleted successfully: {email}")
        
        return {
            "success": True,
            "message": "Account deleted successfully"
        }
        
    except Exception as e:
        logger.error(f"❌ Delete account error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== PROTECTED ENDPOINTS ====================
@app.get("/")
def read_root():
    return {
        "message": "ThynkFlow AI Backend",
        "status": "running",
        "version": "6.0 - With Authentication",
        "storage": "file-based"
    }

@app.post("/chat")
async def chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Smart chat endpoint - PROTECTED"""
    session_id = request.session_id
    user_id = current_user['user_id']  # Use authenticated user ID
    session_created = False
    
    try:
        prompt_type = classify_prompt(request.message) if request.mode == "auto" else request.mode
        
        session_data = load_chat_session(user_id, session_id)
        is_new_session = session_data is None
        
        # Extract number of ideas requested
        num_requested = None
        number_patterns = [
            r'(\d+)\s+ideas?',
            r'give\s+me\s+(\d+)',
            r'suggest\s+(\d+)',
            r'generate\s+(\d+)'
        ]
        for pattern in number_patterns:
            match = re.search(pattern, request.message.lower())
            if match:
                num_requested = int(match.group(1))
                break
        
        # Create or get chat object
        if session_id not in active_chat_objects:
            model = create_model_for_session(prompt_type, session_id=session_id)
            active_chat_objects[session_id] = model.start_chat(history=[])
            logger.info(f"✅ Created chat object for session {session_id}")
        
        chat_obj = active_chat_objects[session_id]
        response_text = None
        
        # Try to get response with model fallback
        models_to_try = [m for m in AVAILABLE_MODELS if m not in failed_models[session_id]]
        
        if not models_to_try:
            logger.warning("⚠️ All models marked as failed, resetting list")
            failed_models[session_id].clear()
            models_to_try = AVAILABLE_MODELS.copy()
        
        max_attempts = min(len(models_to_try), 5)
        
        for attempt in range(max_attempts):
            try:
                response = chat_obj.send_message(request.message)
                response_text = response.text
                logger.info(f"✅ Successfully got response on attempt {attempt + 1}")
                break
                
            except Exception as e:
                error_msg = str(e)
                
                if "429" in error_msg or "quota" in error_msg.lower() or "resource exhausted" in error_msg.lower():
                    current_model = models_to_try[0] if models_to_try else "unknown"
                    
                    try:
                        if hasattr(chat_obj, '_model') and hasattr(chat_obj._model, 'model_name'):
                            current_model = chat_obj._model.model_name
                    except:
                        pass
                    
                    failed_models[session_id].add(current_model)
                    logger.warning(f"⚠️ Quota exceeded for {current_model}")
                    
                    if current_model in models_to_try:
                        models_to_try.remove(current_model)
                    
                    if attempt < max_attempts - 1 and models_to_try:
                        next_model = models_to_try[0]
                        logger.info(f"🔄 Switching to model: {next_model}")
                        
                        try:
                            system_instruction = """You are ThynkFlow AI, an expert ideation and innovation assistant.""" if prompt_type == 'ideation' else """You are ThynkFlow AI, a helpful, friendly, and knowledgeable assistant."""
                            
                            new_model = genai.GenerativeModel(next_model, system_instruction=system_instruction)
                            chat_obj = new_model.start_chat(history=[])
                            active_chat_objects[session_id] = chat_obj
                            
                            logger.info(f"✅ Successfully switched to {next_model}")
                            continue
                            
                        except Exception as model_error:
                            logger.error(f"❌ Failed to switch to {next_model}: {model_error}")
                            failed_models[session_id].add(next_model)
                            if next_model in models_to_try:
                                models_to_try.remove(next_model)
                            continue
                    else:
                        raise HTTPException(
                            status_code=429,
                            detail={
                                "error": "quota_exceeded",
                                "message": "All available Gemini models have exceeded their quota limits.",
                                "solutions": [
                                    "Wait 60 seconds and try again",
                                    "Get a new API key from https://makersuite.google.com/app/apikey",
                                    "Upgrade your API quota"
                                ],
                                "failed_models": list(failed_models[session_id])
                            }
                        )
                else:
                    logger.error(f"❌ Non-quota error: {error_msg}")
                    raise HTTPException(status_code=500, detail=str(e))
        
        if response_text is None:
            raise HTTPException(
                status_code=500,
                detail="Failed to get response after trying all available models"
            )
        
        # Generate title for new session
        generated_title = None
        if is_new_session:
            logger.info("🏷️ Generating chat title...")
            generated_title = await generate_chat_title(request.message, response_text)
            
            created_at = datetime.now()
            chat_number = get_chat_number(user_id)
            
            session_data = {
                'session_id': session_id,
                'user_id': user_id,
                'title': generated_title,
                'chat_number': chat_number,
                'created_at': created_at.isoformat(),
                'updated_at': created_at.isoformat(),
                'prompt_type': prompt_type,
                'messages': []
            }
            
            save_chat_session(session_data)
            session_created = True
            logger.info(f"✅ Created session: Chat #{chat_number}")
        
        # Score ideas if applicable
        scores_list = []
        trends = []
        should_score = False
        
        if len(response_text) > 200:
            is_asking_clarification = (
                response_text.strip().endswith('?') and 
                len(response_text.split('\n')) < 5
            )
            
            has_numbered_list = bool(re.search(r'(?:^|\n)\s*\d+[.)]\s+', response_text, re.MULTILINE))
            has_bulleted_list = bool(re.search(r'(?:^|\n)\s*[-*•]\s+\*\*', response_text, re.MULTILINE))
            has_idea_headers = bool(re.search(r'(?:^|\n)\s*(?:##|\*\*)\s*(?:Idea\s+)?\d+', response_text, re.IGNORECASE))
            
            has_ideation_structure = has_numbered_list or has_bulleted_list or has_idea_headers
            
            user_requested_ideas = any(keyword in request.message.lower() for keyword in [
                'give me', 'suggest', 'ideas', 'idea', 'brainstorm', 'generate', 
                'create', 'help me with', 'come up with', 'think of'
            ])
            
            has_multiple_ideas = response_text.lower().count('idea') >= 2
            
            should_score = (
                not is_asking_clarification and 
                (
                    (user_requested_ideas and has_ideation_structure) or
                    (has_numbered_list and has_multiple_ideas) or
                    has_idea_headers
                )
            )
        
        if should_score:
            logger.info("📊 Extracting and scoring individual ideas...")
            
            ideas = extract_ideas_from_response(response_text, num_requested)
            
            if ideas:
                logger.info(f"✅ Found {len(ideas)} ideas to score")
                
                for idea_data in ideas:
                    logger.info(f"📊 Scoring idea {idea_data['number']}/{len(ideas)}")
                    idea_score = score_idea(idea_data, request.message)
                    scores_list.append(idea_score)
                
                logger.info(f"✅ Successfully scored all {len(scores_list)} ideas")
                
                if prompt_type == 'ideation':
                    trends = get_trending_topics(request.message)
        
        # Save messages to file
        user_message = {
            'role': 'user',
            'content': request.message,
            'message_type': prompt_type,
            'timestamp': datetime.now().isoformat()
        }
        
        assistant_message = {
            'role': 'assistant',
            'content': response_text,
            'message_type': prompt_type,
            'timestamp': datetime.now().isoformat(),
            'scores': scores_list if scores_list else None
        }
        
        add_message_to_session(user_id, session_id, user_message)
        add_message_to_session(user_id, session_id, assistant_message)
        
        return {
            "response": response_text,
            "session_id": session_id,
            "prompt_type": prompt_type,
            "scores": scores_list if scores_list else None,
            "trends": trends if trends else None,
            "ideas_count": len(scores_list) if scores_list else 0,
            "title": generated_title,
            "timestamp": datetime.now().isoformat()
        }
    
    except HTTPException as http_err:
        if session_created:
            delete_chat_session(user_id, session_id)
        raise http_err
    
    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ Chat error: {error_msg}")
        
        if session_created:
            delete_chat_session(user_id, session_id)
        
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/session/new")
async def create_new_session(request: NewSessionRequest, current_user: dict = Depends(get_current_user)):
    """Create a new chat session - PROTECTED"""
    try:
        user_id = current_user['user_id']
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        session_id = f"{user_id}_{timestamp}"
        
        created_at = datetime.now()
        chat_number = get_chat_number(user_id)
        
        title = request.title if request.title else f"Chat #{chat_number}"
        
        session_data = {
            'session_id': session_id,
            'user_id': user_id,
            'title': title,
            'chat_number': chat_number,
            'created_at': created_at.isoformat(),
            'updated_at': created_at.isoformat(),
            'prompt_type': 'conversation',
            'messages': []
        }
        
        save_chat_session(session_data)
        
        return {
            "session_id": session_id,
            "user_id": user_id,
            "title": title,
            "message": "Session created successfully",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Create session error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{user_id}")
async def get_sessions(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get all chat sessions - PROTECTED"""
    try:
        # Verify user owns these sessions
        if user_id != current_user['user_id']:
            raise HTTPException(status_code=403, detail="Access denied")
        
        sessions = get_user_sessions(user_id)
        return {
            "sessions": sessions,
            "count": len(sessions),
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get sessions error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/session/{session_id}/messages")
async def get_messages(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get all messages for a session - PROTECTED"""
    try:
        user_id = current_user['user_id']
        
        session_data = load_chat_session(user_id, session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify ownership
        if session_data.get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        messages = session_data.get('messages', [])
        return {
            "messages": messages,
            "count": len(messages),
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get messages error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/session/{session_id}")
async def delete_session_endpoint(session_id: str, user_id: str = Query(...), current_user: dict = Depends(get_current_user)):
    """Delete a chat session - PROTECTED"""
    try:
        # Verify ownership
        if user_id != current_user['user_id']:
            raise HTTPException(status_code=403, detail="Access denied")
        
        success = delete_chat_session(user_id, session_id)
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {
            "message": "Session deleted successfully",
            "session_id": session_id,
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete session error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/session/{session_id}/title")
async def update_title(session_id: str, request: UpdateTitleRequest, current_user: dict = Depends(get_current_user)):
    """Update session title - PROTECTED"""
    try:
        user_id = current_user['user_id']
        
        session_data = load_chat_session(user_id, session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify ownership
        if session_data.get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        session_data['title'] = request.title
        session_data['updated_at'] = datetime.now().isoformat()
        
        save_chat_session(session_data)
        
        return {
            "message": "Title updated successfully",
            "session_id": session_id,
            "title": request.title,
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Update title error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    # -------------------------------------------------------
# Chat Title Generator (Used in session creation / replies)
# -------------------------------------------------------
async def generate_chat_title(user_message: str, assistant_reply: str) -> str:
    """
    Generate a short chat title based on the latest user message
    and the assistant response. Returns a concise 3–8 word title.
    """
    try:
        prompt = f"""
You create short, clean chat titles.

Generate a title (max 8 words) summarizing the conversation context
based on the user message and the assistant reply.

Do NOT use quotes or emojis.

USER MESSAGE:
{user_message}

ASSISTANT RESPONSE:
{assistant_reply}
"""

        model = get_any_working_model()

        response = model.generate_content(prompt)
        title = (response.text or "").strip()

        # clean result
        title = title.split("\n")[0].strip()
        if len(title) > 80:
            title = title[:77] + "..."
        if not title:
            title = "New Chat"

        return title

    except Exception:
        return "New Chat"


@app.post("/feedback")
async def submit_feedback(request: FeedbackRequest, current_user: dict = Depends(get_current_user)):
    """Submit feedback - PROTECTED"""
    try:
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message is required")
        
        # Prepare feedback data with user info from authentication
        feedback_data = {
            'user_id': current_user['user_id'],
            'user_name': current_user['name'],
            'user_email': current_user['email'],
            'type': request.type,
            'message': request.message.strip()
        }
        
        logger.info(f"💬 Received feedback from {current_user['email']}")
        logger.info(f"   Type: {request.type}")
        logger.info(f"   Message length: {len(request.message)} chars")
        
        # Save feedback to file
        saved = save_feedback(feedback_data)
        
        if not saved:
            logger.error("❌ Failed to save feedback to file")
            raise HTTPException(status_code=500, detail="Failed to save feedback")
        
        logger.info("✅ Feedback saved to file successfully")
        
        # Try to send email (don't fail if this fails)
        email_sent = False
        try:
            logger.info("📧 Attempting to send feedback confirmation email...")
            email_sent = send_feedback_email(feedback_data)
            
            if email_sent:
                logger.info("✅ Feedback email sent successfully")
            else:
                logger.warning("⚠️ Feedback email failed but feedback was saved")
                
        except Exception as email_error:
            logger.error(f"❌ Email sending error (non-critical): {email_error}")
            # Don't fail the request if email fails
        
        return {
            "success": True,
            "email_sent": email_sent,
            "message": "Thank you for your feedback!" if email_sent else "Feedback saved (email delivery failed)",
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Feedback submission error: {str(e)}")
        import traceback
        logger.error(f"   Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "storage": "file-based",
        "auth": "enabled",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get system statistics - PROTECTED"""
    try:
        user_dirs = [d for d in CHATS_DIR.iterdir() if d.is_dir()]
        
        total_sessions = 0
        for user_dir in user_dirs:
            total_sessions += len(list(user_dir.glob("Chat #*.json")))
        
        return {
            "active_chat_objects": len(active_chat_objects),
            "total_users": len(list(USERS_DIR.glob("*.json"))),
            "total_sessions": total_sessions,
            "current_model": WORKING_MODEL,
            "storage_path": str(STORAGE_BASE_DIR.absolute()),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/refresh-model")
async def refresh_model(current_user: dict = Depends(get_current_user)):
    """Refresh and test available models - PROTECTED"""
    try:
        global WORKING_MODEL
        logger.info("🔄 Refreshing model configuration...")
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found")
        
        genai.configure(api_key=api_key)
        
        new_model = get_available_model()
        WORKING_MODEL = new_model
        
        return {
            "success": True,
            "model": WORKING_MODEL,
            "message": f"Model refreshed successfully. Using: {WORKING_MODEL}",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Model refresh error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Starting ThynkFlow AI Backend v6.0 (With Authentication)")
    logger.info(f"📁 Storage directory: {STORAGE_BASE_DIR.absolute()}")
    logger.info(f"📁 Users directory: {USERS_DIR.absolute()}")
    logger.info(f"📁 Chats directory: {CHATS_DIR.absolute()}")
    logger.info(f"🔧 Backend available at: http://0.0.0.0:8000")
    logger.info(f"🤖 Using model: {WORKING_MODEL}")
    logger.info("✨ Features:")
    logger.info("  - ✅ Email-based authentication")
    logger.info("  - ✅ Email verification with codes")
    logger.info("  - ✅ Password reset functionality")
    logger.info("  - ✅ JWT token authentication")
    logger.info("  - ✅ Protected API endpoints")
    logger.info("  - ✅ User-isolated chat storage")
    uvicorn.run(app, host="0.0.0.0", port=8000)