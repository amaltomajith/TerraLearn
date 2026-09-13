"""
Direct Python port of src/lib/api.ts's CROP_DATABASE (lines 78-339) and
calculateHarvestDate (lines 1059-1065). Keep the two in sync by hand — this is
a transcription, not a reimplementation; the numbers must match exactly so the
Farmer MCP server and the web dashboard never disagree about the same crop.
"""
from dataclasses import dataclass, field
from datetime import date, timedelta


@dataclass
class CropInfo:
    name: str
    growing_days: int  # days from planting to harvest
    base_yield: float  # tons per hectare
    base_price: float  # USD per ton
    optimal_temp_min: float
    optimal_temp_max: float
    optimal_ph_min: float
    optimal_ph_max: float
    optimal_humidity_min: float
    optimal_humidity_max: float
    seasons: list[str] = field(default_factory=list)


CROP_DATABASE: dict[str, CropInfo] = {
    "wheat": CropInfo("Wheat", 120, 3.5, 250, 10, 25, 6.0, 7.5, 40, 70, ["autumn", "spring"]),
    "corn": CropInfo("Corn", 100, 10.5, 180, 18, 33, 5.8, 7.0, 50, 80, ["spring", "summer"]),
    "soybeans": CropInfo("Soybeans", 100, 3.2, 450, 20, 30, 6.0, 7.0, 50, 85, ["spring", "summer"]),
    "rice": CropInfo("Rice", 150, 7.0, 380, 20, 35, 5.5, 6.5, 70, 95, ["spring", "summer"]),
    "barley": CropInfo("Barley", 90, 3.8, 220, 8, 22, 6.0, 8.0, 40, 65, ["autumn", "spring"]),
    "oats": CropInfo("Oats", 90, 2.8, 200, 5, 20, 5.5, 7.0, 50, 75, ["spring"]),
    "cotton": CropInfo("Cotton", 180, 2.5, 1600, 20, 37, 5.8, 8.0, 40, 60, ["spring", "summer"]),
    "potatoes": CropInfo("Potatoes", 100, 40.0, 300, 10, 25, 5.0, 6.5, 60, 80, ["spring"]),
    "tomatoes": CropInfo("Tomatoes", 80, 70.0, 850, 18, 30, 6.0, 6.8, 50, 70, ["spring", "summer"]),
    "sorghum": CropInfo("Sorghum", 120, 4.0, 170, 20, 38, 5.5, 8.5, 30, 60, ["spring", "summer"]),
    "sugarcane": CropInfo("Sugarcane", 365, 75.0, 50, 22, 38, 5.0, 8.5, 60, 90, ["spring"]),
    "lettuce": CropInfo("Lettuce", 55, 35.0, 1200, 7, 20, 6.0, 7.0, 50, 70, ["spring", "autumn"]),
    "carrots": CropInfo("Carrots", 80, 40.0, 700, 10, 25, 6.0, 6.8, 50, 70, ["spring", "autumn"]),
    "onions": CropInfo("Onions", 100, 50.0, 400, 12, 28, 6.0, 7.0, 40, 65, ["spring", "autumn"]),
    "cabbage": CropInfo("Cabbage", 90, 50.0, 350, 10, 22, 6.0, 7.5, 60, 80, ["spring", "autumn"]),
    "spinach": CropInfo("Spinach", 45, 20.0, 1500, 5, 20, 6.0, 7.5, 50, 70, ["spring", "autumn", "winter"]),
    "peppers": CropInfo("Peppers", 75, 25.0, 900, 18, 32, 6.0, 7.0, 50, 70, ["spring", "summer"]),
    "cucumbers": CropInfo("Cucumbers", 60, 40.0, 600, 18, 30, 6.0, 7.0, 60, 80, ["spring", "summer"]),
    "strawberries": CropInfo("Strawberries", 90, 20.0, 3000, 10, 26, 5.5, 6.5, 60, 80, ["spring"]),
    "grapes": CropInfo("Grapes", 170, 15.0, 1800, 15, 35, 5.5, 7.0, 40, 60, ["spring"]),
}


def calculate_harvest_date(planting_date: date, crop: str) -> date:
    info = CROP_DATABASE.get(crop.lower())
    growing_days = info.growing_days if info else 100
    return planting_date + timedelta(days=growing_days)
