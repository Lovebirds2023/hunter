
from typing import Dict, Any

def calculate_who5_score(answers: Dict[str, Any]) -> int:
    """
    WHO-5 Wellbeing Index
    - 5 questions, scale 0-5
    - Raw score 0-25
    - Percentage score = raw * 4
    """
    if not answers:
        return 0
    
    raw_sum = 0
    count = 0
    for k, v in answers.items():
        if k.startswith('who5_'):
            raw_sum += int(v)
            count += 1
    
    if count == 0:
        return 0
        
    # Standard WHO-5 is 5 questions. If partial, we average and scale.
    normalized_raw = (raw_sum / count) * 5
    return int(normalized_raw * 4)

def calculate_pss10_score(answers: Dict[str, Any]) -> int:
    """
    PSS Stress Score (Simplified version from the app)
    In this app, we have 4 questions:
    0: Upset unexpectedly (Negative)
    1: Unable to control (Negative)
    2: Confident (Positive - Reverse Score)
    3: Things going your way (Positive - Reverse Score)
    
    Scale 0-4
    """
    if not answers:
        return 0
        
    raw_sum = 0
    count = 0
    
    # Mapping based on ProgramJourneyScreen.js indices
    # Question IDs: pss_0, pss_1, pss_2, pss_3
    neg_items = ['pss_0', 'pss_1']
    pos_items = ['pss_2', 'pss_3']
    
    for k, v in answers.items():
        if k in neg_items:
            raw_sum += int(v)
            count += 1
        elif k in pos_items:
            # Reverse score: 4 - value
            raw_sum += (4 - int(v))
            count += 1
            
    if count == 0:
        return 0
        
    # Scaling to 0-100 for consistent visualization
    # Max raw for 4 questions is 16
    max_raw = count * 4
    return int((raw_sum / max_raw) * 100)

def calculate_relationship_score(answers: Dict[str, Any]) -> int:
    """Relationship confidence and bond"""
    if not answers: return 0
    raw = 0; count = 0
    for k, v in answers.items():
        if k.startswith('rel_'):
            raw += int(v)
            count += 1
    if count == 0: return 0
    return int((raw / (count * 4)) * 100)

def calculate_dog_welfare_score(answers: Dict[str, Any]) -> int:
    """Dog welfare snapshot"""
    if not answers: return 0
    raw = 0; count = 0
    for k, v in answers.items():
        if k.startswith('wel_'):
            raw += int(v)
            count += 1
    if count == 0: return 0
    return int((raw / (count * 4)) * 100)
