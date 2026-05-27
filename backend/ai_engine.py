import cv2
import numpy as np
import uuid

class DogIDEngine:
    def __init__(self):
        self.orb = cv2.ORB_create(nfeatures=500)
        self.bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

    def extract_descriptor(self, image_bytes: bytes):
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return None
        
        kp, des = self.orb.detectAndCompute(img, None)
        if des is None:
            return None
            
        return des.tolist()

    def match_descriptors(self, des1_list, des2_list):
        if not des1_list or not des2_list:
            return 0.0
            
        des1 = np.array(des1_list, dtype=np.uint8)
        des2 = np.array(des2_list, dtype=np.uint8)
        
        matches = self.bf.match(des1, des2)
        matches = sorted(matches, key=lambda x: x.distance)
        
        # Simple confidence score based on match count and distances
        if not matches:
            return 0.0
            
        score = sum(1 for m in matches if m.distance < 50)
        confidence = (score / min(len(des1), len(des2))) * 100
        return min(confidence, 100.0)

    def identify_dog(self, target_des, known_dogs):
        results = []
        for dog in known_dogs:
            confidence = self.match_descriptors(target_des, dog.nose_print_descriptor)
            results.append({
                "dog_id": dog.id,
                "name": dog.name,
                "confidence": confidence
            })
            
        results = sorted(results, key=lambda x: x["confidence"], reverse=True)
        return results[0] if results else None
