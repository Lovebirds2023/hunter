import os
import json

translation_dir = 'frontend/src/translations'
files = os.listdir(translation_dir)

new_keys = {
    "save": "Save",
    "saved": "Saved",
    "unsave": "Unsave",
    "saved_events": "Saved Events",
    "form_builder": "Form Builder",
    "add_field": "Add Field",
    "share_phone": "Share Phone Number",
    "registration_form": "Registration Form",
    "view_responses": "View Responses",
    "no_saved_events": "No saved events"
}

for file in files:
    if file.endswith('.json'):
        filepath = os.path.join(translation_dir, file)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if "events" not in data:
                data["events"] = {}
                
            for k, v in new_keys.items():
                if k not in data["events"]:
                    data["events"][k] = v
                    
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            print(f"Updated {file}")
        except Exception as e:
            print(f"Error processing {file}: {e}")
