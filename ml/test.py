import pickle

with open("datasets/WESAD/S2/S2.pkl", "rb") as f:
    data = pickle.load(f, encoding="latin1")

print(data.keys())
print(data["signal"]["wrist"].keys())
import numpy as np

print(np.unique(data["label"]))

print(len(data["signal"]["wrist"]["BVP"]))
print(len(data["signal"]["wrist"]["EDA"]))
print(len(data["signal"]["wrist"]["TEMP"]))
print(len(data["label"]))