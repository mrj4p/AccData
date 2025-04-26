# 🚦 Road Accident Mapping & Analysis Platform

![image](https://github.com/user-attachments/assets/48ae8037-0061-4df6-9b58-911ba2a41a88)

*Visualizing accident hotspots and route safety*

## 🌟 Key Features

### 🗺️ Interactive Mapping
| Feature | Description |
|---------|-------------|
| Cluster Visualization | Dynamic accident clustering at different zoom levels |
| Heatmap Overlay | Color-coded density visualization of accident hotspots |
| Severity Filtering | Color-coded markers (red=fatal, green=non-fatal) |

### 🚗 Route Safety Analysis
- **Route Planning**: Find paths between locations with accident visibility
- **Danger Zones**: 500m buffer analysis around routes
- **Safety Score**: Accident density scoring along routes

### 📊 Data Analytics Dashboard
"
"
"

Installation Guide
Prerequisites
Node.js 18+
MongoDB 6.0+
Mapbox API token

Setup
1. Clone repository: git clone https://github.com/dededwin/AccData.git

2. Install dependencies: npm install && cd backend && npm start && node server.js

3. Configure environment:
echo "MAPBOX_ACCESS_TOKEN=your_token" >> .env
echo "MONGODB_URI=mongodb://localhost:27017/accidents" >> .env


5. Import sample data: npm run import-data

User Documentation
Basic Controls
Action	         Result
Click cluster	 Zooms to cluster area
Click accident	 Shows detailed popup
Shift+drag	     Create zoom rectangle

Route Analysis Workflow
1. Enter addresses in start/end fields
2. Click "Search Route"
3. View accident markers along path
4. Use filters to refine analysis

🙋 Support

For assistance, please:
1. Check open issues
2. Email: 
