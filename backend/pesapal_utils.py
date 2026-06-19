import requests
import os
import uuid
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

REQUEST_TIMEOUT = 15

class PesapalAPI:
    def __init__(self):
        self.consumer_key = os.getenv("PESAPAL_CONSUMER_KEY")
        self.consumer_secret = os.getenv("PESAPAL_CONSUMER_SECRET")
        self.env = os.getenv("PESAPAL_ENV", "live")
        
        if self.env == "live":
            self.base_url = "https://pay.pesapal.com/v3"
        else:
            self.base_url = "https://cybapi.pesapal.com/v3"
            
        self.token = None

    def get_token(self):
        url = f"{self.base_url}/api/Auth/RequestToken"
        payload = {
            "consumer_key": self.consumer_key,
            "consumer_secret": self.consumer_secret
        }
        try:
            response = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
            if response.status_code == 200:
                self.token = response.json().get("token")
                return self.token
        except requests.RequestException:
            return None
        return None

    def register_ipn(self, ipn_url):
        if not self.token:
            self.get_token()
            
        url = f"{self.base_url}/api/URLSetup/RegisterIPN"
        payload = {
            "url": ipn_url,
            "ipn_notification_type": "GET"
        }
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
            return response.json()
        except requests.RequestException as exc:
            return {"error": f"Pesapal IPN registration failed: {exc}"}
        except ValueError:
            return {"error": "Pesapal returned an invalid IPN response"}

    def submit_order(self, order_id, amount, description, email, phone, callback_url, ipn_id, currency="KES"):
        if not self.token:
            self.get_token()
            
        url = f"{self.base_url}/api/Transactions/SubmitOrderRequest"
        payload = {
            "id": order_id,
            "currency": currency or "KES",
            "amount": amount,
            "description": description,
            "callback_url": callback_url,
            "notification_id": ipn_id,
            "billing_address": {
                "email_address": email,
                "phone_number": phone,
                "country_code": "KE",
                "first_name": "Customer",
                "last_name": "User"
            }
        }
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
            return response.json()
        except requests.RequestException as exc:
            return {"error": f"Pesapal order submission failed: {exc}"}
        except ValueError:
            return {"error": "Pesapal returned an invalid checkout response"}

    def get_transaction_status(self, tracking_id):
        if not self.token:
            self.get_token()
            
        url = f"{self.base_url}/api/Transactions/GetTransactionStatus?OrderTrackingId={tracking_id}"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        try:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            return response.json()
        except requests.RequestException as exc:
            return {"error": f"Pesapal status check failed: {exc}"}
        except ValueError:
            return {"error": "Pesapal returned an invalid status response"}
