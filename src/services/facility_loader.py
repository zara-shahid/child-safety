import logging
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

logger = logging.getLogger(__name__)


class FacilityLoader:
    """Loads facility data from dataset into memory on startup."""

    _instance = None
    _facilities: List[Dict[str, Any]] = []

    @classmethod
    def get_facilities(cls) -> List[Dict[str, Any]]:
        if cls._instance is None:
            cls.load_data()
        return cls._facilities

    @classmethod
    def load_data(cls) -> None:
        if cls._instance is not None:
            return
            
        cls._instance = cls()
        
        # Determine paths relative to this file
        # This file is in src/services/, so data is in child-safety/data/
        # base_dir = f:/hack-nation/child-safety/data
        base_dir = Path(__file__).resolve().parent.parent.parent / "data"
        
        csv_path = base_dir / "India_Facilities_Dataset.csv"
        xlsx_path = base_dir / "VF_Hackathon_Dataset_India_Large.xlsx"

        try:
            if csv_path.exists():
                logger.info(f"Loading facilities from {csv_path}")
                df = pd.read_csv(csv_path)
            elif xlsx_path.exists():
                logger.info(f"Loading facilities from {xlsx_path}")
                df = pd.read_excel(xlsx_path)
            else:
                logger.warning("No facility dataset found in data directory.")
                cls._facilities = []
                return
            
            # Fill NaN values with None to convert to clean dicts
            df = df.where(pd.notnull(df), None)
            
            records = df.to_dict(orient="records")
            
            valid_facilities = []
            for record in records:
                try:
                    lat_val = record.get('latitude')
                    lng_val = record.get('longitude')
                    
                    if pd.isna(lat_val) or pd.isna(lng_val) or lat_val is None or lng_val is None:
                        # Allow missing coords to be checked by trust scorer later
                        pass
                    else:
                        record['latitude'] = float(lat_val)
                        record['longitude'] = float(lng_val)
                        
                    valid_facilities.append(record)
                except (ValueError, TypeError):
                    # Continue if float conversion fails
                    valid_facilities.append(record)
            
            cls._facilities = valid_facilities
            logger.info(f"Loaded {len(valid_facilities)} facilities into memory.")
            
        except Exception as e:
            logger.error(f"Error loading facility dataset: {e}")
            cls._facilities = []
