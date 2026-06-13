import cv2
import numpy as np
import uuid

class DogIDEngine:
    def __init__(self):
        self.sift = cv2.SIFT_create(nfeatures=500)
        self.bf = cv2.BFMatcher(cv2.NORM_L2)

    def extract_descriptor(self, image_bytes: bytes):
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return None
        
        kp, des = self.sift.detectAndCompute(img, None)
        if des is None:
            return None
            
        return des.tolist()

    def match_descriptors(self, des1_list, des2_list):
        if not des1_list or not des2_list:
            return 0.0
            
        des1 = np.array(des1_list, dtype=np.float32)
        des2 = np.array(des2_list, dtype=np.float32)
        if len(des1.shape) != 2 or len(des2.shape) != 2 or des1.shape[1] != des2.shape[1]:
            return 0.0
        
        matches = self.bf.knnMatch(des1, des2, k=2)
        
        if not matches:
            return 0.0

        good_matches = []
        for match_pair in matches:
            if len(match_pair) < 2:
                continue
            best, second_best = match_pair
            if best.distance < 0.75 * second_best.distance:
                good_matches.append(best)

        confidence = (len(good_matches) / min(len(des1), len(des2))) * 100
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
