# app/services/ai_matcher.py
import cv2
import numpy as np
import base64
import logging
from typing import List, Tuple, Optional
from app.models.dog import Dog

logger = logging.getLogger(__name__)

class ORBMatcher:
    def __init__(self):
        # Initialize ORB detector
        self.orb = cv2.ORB_create(nfeatures=500)
        # BFMatcher with Hamming distance
        self.bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

    def compute_descriptor(self, image_base64: str) -> Optional[np.ndarray]:
        try:
            # Decode base64 to image
            img_data = base64.b64decode(image_base64)
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
            
            if img is None:
                return None

            # Compute keypoints and descriptors
            kp, des = self.orb.detectAndCompute(img, None)
            return des
        except Exception as e:
            logger.error(f"Error computing descriptor: {e}")
            return None

    def match_descriptors(self, des1: np.ndarray, des2: np.ndarray) -> float:
        if des1 is None or des2 is None:
            return 0.0
        
        try:
            matches = self.bf.match(des1, des2)
            # Sort matches by distance
            matches = sorted(matches, key=lambda x: x.distance)
            
            # Score logic: more matches with low distance = higher score
            # A simple heuristic: average distance of top 10 matches
            if len(matches) < 10:
                return 0.0 # Not enough matches
            
            top_matches = matches[:20]
            avg_dist = sum(m.distance for m in top_matches) / len(top_matches)
            
            # Hamming distance for ORB is typically 0-256
            # Lower is better. Let's inverse it for logic score.
            # Max acceptable distance ~ 60-70 for "good" match
            if avg_dist > 80:
                return 0.1 # Poor match
                
            # Normalize to 0-1 range (approximate)
            score = max(0, (100 - avg_dist) / 100.0)
            return score
        except Exception:
            return 0.0

    @staticmethod
    def match_score(self, dog: Dog, query_descriptor: np.ndarray, query_color: str = None) -> float:
         # Placeholder for hybrid matching (Attribute + Visual)
         pass

# Singleton logic for the app
orb_matcher = ORBMatcher()

class AIMatcher:
    """
    Hybrid Matcher using ORB + Attributes
    """
    @staticmethod
    def filter_candidates(dogs: List[Dog], query_image_b64: str = None, query_color: str = None) -> List[tuple[Dog, float]]:
        results = []
        
        # 1. Compute Query Descriptor
        query_des = None
        if query_image_b64:
            query_des = orb_matcher.compute_descriptor(query_image_b64)

        for dog in dogs:
            score = 0.0
            
            # Attribute Match
            if query_color and dog.color and query_color.lower() in dog.color.lower():
                score += 0.3
            
            # ORB Match (if dog has stored descriptor - simulated by decoding re-uploaded image for now)
            # In prod, we'd store the descriptor blob in DB to avoid re-computing
            orb_score = 0.0
            if query_des is not None and dog.biometric_profile and dog.biometric_profile.nose_image_url:
                # We need to fetch the image or stored descriptor. 
                # For this prototype, we assume 'nose_print_vector' might store base64 or we skip if not available locally.
                # Let's assume we can't easily fetch remote URL in this sync loop without latency.
                # So we rely on what's in 'nose_print_vector' column.
                
                # If nose_print_vector holds base64 image (prototype hack) or json descriptor
                pass 
            
            # Add ORB placeholder score if "simulated"
            if query_des is not None:
                 # Randomize slightly for demo or use real if we had local files
                 pass

            results.append((dog, score))

        results.sort(key=lambda x: x[1], reverse=True)
        return results

ai_matcher = AIMatcher()
