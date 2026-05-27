import requests, json
base='http://localhost:8000'
headers={'Content-Type':'application/json'}
# Register
reg_payload={
  'email':'test+passport@example.com',
  'full_name':'Test User',
  'role':'BUYER',
  'password':'Password123!',
  'phone_number':'+254700000000',
  'country':'KE',
  'language':'en'
}
try:
    r=requests.post(base+'/register', json=reg_payload, headers=headers, timeout=5)
    print('REGISTER', r.status_code)
    try:
        print(r.json())
    except Exception:
        pass
except Exception as e:
    print('REGISTER ERROR', e)
# Token
try:
    r=requests.post(base+'/token', data={'username':'test+passport@example.com','password':'Password123!'}, timeout=5)
    print('TOKEN', r.status_code)
    token = r.json().get('access_token') if r.status_code==200 else None
    try:
        print(r.json())
    except Exception:
        pass
except Exception as e:
    print('TOKEN ERROR', e)
    token=None
# Create dog
if token:
    dog_payload={'name':'Buddy','breed':'Labrador','color':'Yellow','height':50.0,'weight':25.0,'age':3.5,'pet_type':'dog','body_structure':'medium'}
    h={'Authorization':f'Bearer {token}','Content-Type':'application/json'}
    try:
        r=requests.post(base+'/dogs', json=dog_payload, headers=h, timeout=5)
        print('CREATE DOG', r.status_code)
        try:
            print(r.json())
        except Exception:
            pass
        dog_id=r.json().get('id') if r.status_code==200 else None
    except Exception as e:
        print('CREATE DOG ERROR', e)
        dog_id=None
    # Add two health records
    if dog_id:
        rec1={'record_type':'vaccination','date':'2026-05-01T10:00:00Z','next_due_date':'2027-05-01T10:00:00Z','notes':'Rabies vaccine'}
        rec2={'record_type':'checkup','date':'2026-04-01T10:00:00Z','notes':'Routine checkup'}
        try:
            r1=requests.post(f"{base}/dogs/{dog_id}/health-records", json=rec1, headers=h, timeout=5)
            r2=requests.post(f"{base}/dogs/{dog_id}/health-records", json=rec2, headers=h, timeout=5)
            print('ADD REC1', r1.status_code)
            try:
                print(r1.json())
            except Exception:
                pass
            print('ADD REC2', r2.status_code)
            try:
                print(r2.json())
            except Exception:
                pass
        except Exception as e:
            print('ADD REC ERROR', e)
else:
    print('Skipping dog creation due to missing token')
