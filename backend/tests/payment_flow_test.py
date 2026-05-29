import requests
import json

BASE = 'http://127.0.0.1:8000'

def register_user(email, role):
    payload = {
        'email': email,
        'full_name': 'Test User',
        'role': role,
        'password': 'Password123!',
        'phone_number': '+254700000000',
        'country': 'KE',
        'language': 'en'
    }
    r = requests.post(f"{BASE}/register", json=payload)
    print('REGISTER', email, r.status_code)
    try:
        print(r.json())
    except Exception:
        pass
    return r.status_code

def login(email):
    r = requests.post(f"{BASE}/token", data={'username': email, 'password': 'Password123!'})
    print('TOKEN', email, r.status_code)
    try:
        print(r.json())
    except Exception:
        pass
    return r.json().get('access_token') if r.status_code==200 else None

def create_service(token):
    h = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    payload = {
        'title': 'Test Grooming',
        'description': 'Grooming service',
        'price': 1000.0,
        'category': 'grooming',
        'item_type': 'service',
        'is_published': True
    }
    r = requests.post(f"{BASE}/services", json=payload, headers=h)
    print('CREATE SERVICE', r.status_code)
    try:
        print(r.json())
    except Exception:
        pass
    return r.json().get('id') if r.status_code==200 else None

def create_order(token, service_id):
    h = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    payload = {'service_id': service_id, 'share_phone': False, 'form_responses': []}
    r = requests.post(f"{BASE}/orders", json=payload, headers=h)
    print('CREATE ORDER', r.status_code)
    try:
        print(r.json())
    except Exception:
        pass
    return r.json().get('id') if r.status_code==200 else None

def initiate_payment(token, order_id, amount):
    h = {'Authorization': f'Bearer {token}'}
    params = {'order_id': order_id, 'amount': amount, 'email': 'test+passport@example.com', 'phone': '+254700000000'}
    r = requests.post(f"{BASE}/payments/initiate", headers=h, params=params)
    print('INITIATE PAYMENT', r.status_code)
    try:
        print(json.dumps(r.json(), indent=2))
    except Exception:
        print(r.text)
    return r

if __name__ == '__main__':
    # Ensure provider exists
    register_user('test+provider@example.com', 'provider')
    prov_token = login('test+provider@example.com')
    if not prov_token:
        print('Provider login failed; aborting')
        exit(1)

    service_id = create_service(prov_token)
    if not service_id:
        print('Service creation failed; aborting')
        exit(1)

    # Login as seeded buyer
    buyer_token = login('test+passport@example.com')
    if not buyer_token:
        print('Buyer login failed; aborting')
        exit(1)

    order_id = create_order(buyer_token, service_id)
    if not order_id:
        print('Order creation failed; aborting')
        exit(1)

    # Try to initiate payment (will show Pesapal response or error)
    initiate_payment(buyer_token, order_id, 1000.0)
