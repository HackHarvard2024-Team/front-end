# Albatross Frontend

![image](https://github.com/user-attachments/assets/57325307-b553-435e-967f-b73043a24650)

Albatross is a hackathon project designed to demonstrate how AI and real-time crime data can enhance urban safety by calculating the safest routes for navigation. Built with **Vue.js**, this frontend provides an interactive dashboard showcasing routes that avoid high-risk areas. While currently in demo mode, the project was fully functional during the hackathon and can be fully operational again by reactivating the AWS pipeline.

---

## 🌟 Inspiration

In the journey toward Smart Cities, safety is often sidelined. Many navigation tools prioritize efficiency but fail to consider safety, often leading users into unsafe areas. Albatross seeks to solve this issue by integrating safety into navigation systems, ensuring a smarter, safer travel experience.

---

## ✨ What It Does

Albatross uses real-time crime data and traffic patterns to:

1. Identify high-risk zones (visualized as polygons).
2. Calculate the safest routes, avoiding these zones.
3. Display the routes and risk zones on an intuitive dashboard.

In its current **demo mode**, the project includes **hardcoded polygons** representing high-risk zones on **W 34th St, NYC** and **E 42nd St, NYC**, simulating the functionality of real-time crime data processing. During the hackathon, the system was fully functional with live data processing via AWS.

---

## 🛠 How It Works

1. **Data Collection and Processing**:

   - Crime data is ingested into a **Databricks Delta Lake** from public datasets or live streams.
   - An ETL (Extract, Transform, Load) pipeline processes this data:
     - **E**: Extracts raw crime data.
     - **T**: Transforms the data using MLflow to identify and cluster high-crime zones into **N-gon polygons**.
     - **L**: Loads the processed data into the Delta Lake as structured crime hot zones.

2. **Routing and Navigation**:

   - The list of nearby N-gon crime hot zones is sent to **Cloudflare Workers**, which encode this data into lightweight **flexible polylines**.
   - The **HERE Routing API** receives this encoded data and calculates the safest and fastest route, avoiding these high-crime zones.

3. **Frontend Dashboard**:
   - The **Vue.js** frontend visualizes the safest route and overlays it with the N-gon polygons representing high-risk areas.
   - For demonstration purposes, two preloaded polygons (representing W 34th St and E 42nd St) are used instead of live data processing.

> **Note**: While fully operational during the hackathon, the AWS-based pipeline for real-time crime data processing has been disabled due to cost constraints. The system currently operates in demo mode with hardcoded polygons to showcase its intended functionality.

---

## 🗺️ System Architecture

![image](https://github.com/user-attachments/assets/49d2be29-0a19-4414-be18-914bf2e5c9f0)

---

## 🛡️ Features

- **Interactive Map**: Displays safe routes while overlaying polygons for visual clarity.
- **AI-Powered Safety**: Routes are optimized using AI to avoid high-risk areas.
- **Preloaded Risk Zones**: Hardcoded polygons are used in demo mode for testing and presentation.
- **Seamless Integration**: Combines cutting-edge tools and frameworks to deliver a scalable solution.

---

## 🚀 Tech Stack

### Frontend

- **Vue.js**: For building a dynamic and interactive user interface.
- **HERE Routing API**: For calculating optimal and safe routes.
- **JavaScript**: Core scripting for the frontend.

### Backend & Processing

- **Databricks**: For data storage and ETL pipelines.
- **Delta Lake**: Enables efficient storage and query execution for crime data.
- **MLflow**: Powers AI models for clustering and identifying crime hot zones.
- **Cloudflare Workers**: Handles polyline encoding and routing logic.

### Infrastructure

- **Amazon Web Services (AWS)**: Hosts the entire data pipeline.
- **Scala & Python**: Used for data preprocessing and AI model implementation.
- **OpenAI**: Assists with advanced decision-making and routing models.

---

## 🌐 Live Demo

Try out the hackathon demonstration here:  
🔗 [Albatross Dashboard](https://albatross-hack.netlify.app)

---

## 🏆 Accomplishments

- Successfully built a hackathon-ready frontend showcasing core functionalities.
- Fully operational during the hackathon, leveraging AWS for real-time crime data ingestion and processing.
- Demonstrated route safety visualization with hardcoded data in demo mode.

---

## 📚 Lessons Learned

- Learned to simulate real-time data with hardcoded examples under budget constraints.
- Improved skills in building responsive map-based user interfaces.
- Gained hands-on experience with HERE Routing API.

---

## 🌟 What's Next

- **Real-Time Crime Data**: Reactivate AWS services for dynamic polygon updates.
- **Advanced Routing Logic**: Implement machine learning models for predictive safety mapping.
- **Custom Features**: Allow users to personalize routes based on their preferences.

---

## 🤝 Contributing

We welcome contributions to improve the project! Feel free to fork the repository and submit a pull request.

---
