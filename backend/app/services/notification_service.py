import logging
import json

logger = logging.getLogger(__name__)

try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    FCM_AVAILABLE = True
except ImportError:
    FCM_AVAILABLE = False
    logger.warning("firebase-admin not installed. Push notifications will be logged only.")

# Initialize Firebase Admin SDK (only once)
_firebase_initialized = False

def _init_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return
    if not FCM_AVAILABLE:
        return
    
    import os
    import json
    
    cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    
    try:
        if cred_json:
            cred_dict = json.loads(cred_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info("Firebase Admin SDK initialized successfully via JSON env var.")
        elif cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info("Firebase Admin SDK initialized successfully via file path.")
        else:
            logger.warning(
                "Neither FIREBASE_CREDENTIALS_JSON nor valid FIREBASE_CREDENTIALS_PATH was found. "
                "Push notifications will be logged only."
            )
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}")


class NotificationService:
    @staticmethod
    def send_push_notification(token: str, title: str, body: str, data: dict = None):
        """
        Send a push notification via Firebase Cloud Messaging (FCM).
        Falls back to logging if FCM is not configured.
        """
        _init_firebase()
        
        if not FCM_AVAILABLE or not _firebase_initialized:
            logger.info(f"[FCM Fallback] Would send to {token}: {title} - {body}")
            return True
        
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data or {},
                token=token,
            )
            response = messaging.send(message)
            logger.info(f"FCM message sent successfully: {response}")
            return True
        except messaging.UnregisteredError:
            logger.warning(f"FCM token is unregistered (stale): {token[:20]}...")
            return False
        except Exception as e:
            logger.error(f"FCM send failed: {e}")
            return False

    @staticmethod
    def send_multicast(tokens: list, title: str, body: str, data: dict = None):
        """Send push notification to multiple devices."""
        _init_firebase()
        
        if not FCM_AVAILABLE or not _firebase_initialized or not tokens:
            logger.info(f"[FCM Fallback] Would multicast to {len(tokens)} devices: {title}")
            return True
        
        try:
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data or {},
                tokens=tokens,
            )
            response = messaging.send_each_for_multicast(message)
            logger.info(
                f"FCM multicast: {response.success_count} success, "
                f"{response.failure_count} failures"
            )
            return True
        except Exception as e:
            logger.error(f"FCM multicast failed: {e}")
            return False


notification_service = NotificationService()
