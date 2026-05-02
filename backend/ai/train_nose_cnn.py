# ai/train_nose_cnn.py
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
# import torchvision.transforms as transforms
# from PIL import Image
import os

"""
TEMPLATE: Convolutional Neural Network for Dog Nose Print Identification.
Start here when you have 10k+ labeled nose print images.
"""

class NosePrintNet(nn.Module):
    def __init__(self, num_classes=1000):
        super(NosePrintNet, self).__init__()
        # Siamese Network / Triplet Loss architecture preferred for identification
        # But here is a simple classification backbone
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),
        )
        self.classifier = nn.Sequential(
            nn.Linear(64 * 56 * 56, 128), # Assuming 224x224 input -> 56x56 feature map
            nn.ReLU(),
            nn.Linear(128, num_classes) # Logic: Softmax/ArcFace output
        )

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        x = self.classifier(x)
        return x

def train():
    print("Training loop setup...")
    # 1. Load Data
    # dataset = MyNoseDataset("path/to/data")
    # loader = DataLoader(dataset, batch_size=32, shuffle=True)
    
    # 2. Init Model
    # model = NosePrintNet()
    # criterion = nn.CrossEntropyLoss() (or TripletMarginLoss)
    # optimizer = optim.Adam(model.parameters(), lr=0.001)

    # 3. Validation / Save
    print("This is a template. Populate dataset loader to run.")

if __name__ == "__main__":
    train()
