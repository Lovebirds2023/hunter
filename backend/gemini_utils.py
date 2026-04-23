
import os
import logging
import google.generativeai as genai
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class GeminiAdvisor:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-pro')
        else:
            self.model = None

    def generate_health_insights(self, dog_data: Dict[str, Any], records: List[Dict[str, Any]], wellness_stats: Dict[str, Any]) -> Dict[str, Any]:
        if not self.model:
            return None
        
        # Prepare context
        records_summary = "\n".join([f"- {r.record_type}: {r.notes} ({r.date})" for r in records[:5]])
        
        prompt = f"""
        You are a friendly, expert veterinary technician advisor for the Lovedogs 360 program.
        Your goal is to provide helpful, actionable health insights for a dog owner based on their companion's data.

        Dog Profile:
        - Name: {dog_data.get('name')}
        - Breed: {dog_data.get('breed')}
        - Age: {dog_data.get('age')} years
        - Weight: {dog_data.get('weight')} kg

        Recent Medical Records:
        {records_summary or "No recent medical records."}

        Wellness Scores (0-100 scale):
        - Human Wellbeing: {wellness_stats.get('who5_score', 'N/A')}%
        - Dog Welfare: {wellness_stats.get('welfare_score', 'N/A')}%
        - Human-Dog Bond: {wellness_stats.get('relationship_score', 'N/A')}%
        - Overall Program Score: {wellness_stats.get('overall_score', 'N/A')}%

        Instructions:
        1. Provide 3-4 specific, concise health insights or recommendations. 
        2. Keep the tone warm, professional, and encouraging.
        3. Reference the specific breed or data points where relevant.
        4. Include one "Pro-Tip" for the owner.
        5. Format as JSON with "insights" (list of strings) and "pro_tip" (string).

        Example Format:
        {{
          "insights": ["...", "..."],
          "pro_tip": "..."
        }}
        """

        try:
            response = self.model.generate_content(prompt)
            # Try to parse JSON from response.text
            import json
            import re
            
            # Extract JSON if wrapped in code blocks
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Gemini API Error: {e}")
            return None
