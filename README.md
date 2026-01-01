<p align="center">
  <img src="https://github.com/user-attachments/assets/be7b93ee-8ddd-440c-ac5c-561304122f8c" alt="Albatross App Screenshot" width="800"/>
</p>

<h1 align="center">🦅 Albatross</h1>

<p align="center">
  <strong>Get home faster. Safer. Smarter.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Built%20At-HackHarvard%202024-crimson?style=for-the-badge" alt="HackHarvard 2024"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue.js-4FC08D?style=flat-square&logo=vue.js&logoColor=white" alt="Vue.js"/>
  <img src="https://img.shields.io/badge/Cloudflare-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare"/>
  <img src="https://img.shields.io/badge/Databricks-FF3621?style=flat-square&logo=databricks&logoColor=white" alt="Databricks"/>
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white" alt="OpenAI"/>
  <img src="https://img.shields.io/badge/HERE-00AFAA?style=flat-square&logo=here&logoColor=white" alt="HERE Maps"/>
</p>

<p align="center">
  <a href="#overview">Overview</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#tech-stack">Tech Stack</a> &bull;
  <a href="#repositories">Repositories</a> &bull;
  <a href="#getting-started">Getting Started</a> &bull;
  <a href="#team">Team</a>
</p>

---

## Overview

**Albatross** is an AI-powered navigation system that prioritizes your safety by calculating routes that avoid crime hot-zones. Like the albatross bird that never fails to find its way home, our application ensures you reach your destination through the safest possible path.

Traditional navigation apps optimize for distance or time. Albatross optimizes for **your safety**. By aggregating criminal history data with real-time traffic and city layout information, we provide quick, safe, and efficient routing.

### The Problem

Many of us have experienced moments when navigation apps have led us into areas that felt unsafe or uneasy. Current routing solutions don't factor in neighborhood safety, leaving users vulnerable to potentially dangerous situations.

### The Solution

Albatross uses machine learning to:

- Analyze historical crime data
- Generate dynamic crime hot-zones
- Calculate routes that intelligently avoid high-risk areas
- Provide real-time rerouting based on safety scores

---

## Features

| Feature                   | Description                                               |
| ------------------------- | --------------------------------------------------------- |
| **Interactive Map**       | Beautiful, intuitive map powered by HERE Maps API         |
| **Multi-Modal Transport** | Car, pedestrian, bicycle, truck, scooter, taxi, and bus   |
| **Danger Sensitivity**    | Customize safety threshold with danger level slider (0-5) |
| **Current Location**      | One-click access to your current position                 |
| **Dark Mode**             | Easy on the eyes for night navigation                     |
| **Smart Search**          | Place search with autocomplete                            |
| **Route Instructions**    | Turn-by-turn navigation with time & distance              |
| **Crime Visualization**   | See danger zones highlighted on the map                   |

---

## Architecture

### System Design

<p align="center">
  <img src="https://github.com/user-attachments/assets/49d2be29-0a19-4414-be18-914bf2e5c9f0" alt="Albatross System Architecture" width="800"/>
</p>

### System Overview

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        UI[Vue.js Dashboard]
        MAP[HERE Maps SDK]
    end

    subgraph Edge["Edge Computing"]
        CF[Cloudflare Workers]
        POLY[Polyline Decoder]
        GEO[Geometry Utils]
    end

    subgraph API["External APIs"]
        HERE[HERE Routing API]
        GEOCODE[HERE Geocoding API]
    end

    subgraph Processing["Data Processing"]
        PY[Python Analysis Engine]
        ML[ML Crime Scoring]
        EMB[OpenAI Embeddings]
    end

    subgraph Storage["Data Layer - AWS"]
        DB[(Databricks)]
        DELTA[(Delta Lake)]
        MLFLOW[MLflow]
    end

    subgraph Data["Data Sources"]
        CRIME[Crime Data CSV]
        GEO_DATA[GeoJSON Boundaries]
        GOOGLE[Google Geocoding API]
    end

    UI --> MAP
    UI -->|"Route Request"| HERE
    UI -->|"Encoded Polyline"| CF
    CF --> POLY
    CF --> GEO
    CF -->|"Fetch Crime Zones"| DB

    HERE -->|"Re-calculated Route"| UI
    CF -->|"N-gon Crime Hotzones"| UI

    CRIME --> PY
    GEO_DATA --> PY
    PY --> ML
    ML --> EMB
    PY -->|"Crime Blocks"| DELTA

    DB --> DELTA
    DB --> MLFLOW

    GOOGLE --> PY
```

### Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant V as Vue.js App
    participant H as HERE API
    participant C as Cloudflare Worker
    participant D as Databricks

    U->>V: Enter Origin & Destination
    V->>H: Request Initial Route
    H-->>V: Return Polyline
    V->>C: Send Polyline + Danger Level
    C->>D: Query Crime Zones
    D-->>C: Return N-gon Polygons
    C->>C: Check Intersections
    C-->>V: Return Overlapping Zones
    V->>V: Display Crime Zones
    V->>H: Request Route (Avoid Areas)
    H-->>V: Return Safe Route
    V-->>U: Display Safe Navigation
```

### Crime Data Processing Pipeline

```mermaid
flowchart LR
    subgraph ETL["ETL Pipeline"]
        E[Extract]
        T[Transform]
        L[Load]
    end

    subgraph Extract
        CSV[Crime CSV Files]
        GEO[GeoJSON Boundaries]
    end

    subgraph Transform
        ADDR[Address Geocoding]
        BLOCK[Block Assignment]
        EMBED[Crime Embeddings]
        SCORE[Severity Scoring]
        CLUSTER[K-Means Clustering]
    end

    subgraph Load
        DELTA[(Delta Lake)]
        FINAL[final_fast.csv]
    end

    CSV --> E
    GEO --> E
    E --> ADDR
    ADDR --> BLOCK
    BLOCK --> EMBED
    EMBED --> SCORE
    SCORE --> CLUSTER
    CLUSTER --> L
    L --> DELTA
    L --> FINAL
```

### Crime Severity Classification

```mermaid
graph TD
    subgraph Input
        CRIME[Crime Description]
    end

    subgraph Processing
        EMB[OpenAI Embeddings]
        COS[Cosine Similarity]
    end

    subgraph Reference["Reference Embeddings"]
        R0["Level 0: Safe"]
        R1["Level 1: Low"]
        R2["Level 2: High"]
    end

    subgraph Output
        SCORE[Severity Score 0-2]
    end

    CRIME --> EMB
    EMB --> COS
    R0 --> COS
    R1 --> COS
    R2 --> COS
    COS --> SCORE
```

---

## Tech Stack

### Frontend

|                                                Technology                                                | Purpose                 |
| :------------------------------------------------------------------------------------------------------: | ----------------------- |
| <img src="https://img.shields.io/badge/Vue.js-4FC08D?style=for-the-badge&logo=vue.js&logoColor=white" /> | Reactive UI Framework   |
|   <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />   | Fast Development Server |
|               <img src="https://img.shields.io/badge/Pinia-ffd859?style=for-the-badge" />                | State Management        |
|   <img src="https://img.shields.io/badge/HERE-00AFAA?style=for-the-badge&logo=here&logoColor=white" />   | Interactive Mapping     |

### Edge Computing

|                                                        Technology                                                        | Purpose                   |
| :----------------------------------------------------------------------------------------------------------------------: | ------------------------- |
| <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" /> | Serverless Edge Functions |
|     <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />     | Worker Logic              |

### Data Processing

|                                                      Technology                                                       | Purpose               |
| :-------------------------------------------------------------------------------------------------------------------: | --------------------- |
|       <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />        | Data Analysis         |
|       <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" />        | Crime Text Embeddings |
| <img src="https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white" /> | K-Means Clustering    |
|        <img src="https://img.shields.io/badge/NumPy-013243?style=for-the-badge&logo=numpy&logoColor=white" />         | Numerical Processing  |

### Data Storage

|                                                      Technology                                                      | Purpose                 |
| :------------------------------------------------------------------------------------------------------------------: | ----------------------- |
|   <img src="https://img.shields.io/badge/Databricks-FF3621?style=for-the-badge&logo=databricks&logoColor=white" />   | Unified Analytics       |
|                   <img src="https://img.shields.io/badge/Delta_Lake-00ADD8?style=for-the-badge" />                   | ACID Data Lake          |
| <img src="https://img.shields.io/badge/Apache_Spark-E25A1C?style=for-the-badge&logo=apache-spark&logoColor=white" /> | Distributed Computing   |
|       <img src="https://img.shields.io/badge/MLflow-0194E2?style=for-the-badge&logo=mlflow&logoColor=white" />       | ML Lifecycle Management |

### APIs

|       Service        | Purpose                  |
| :------------------: | ------------------------ |
|   HERE Routing API   | Optimal Pathfinding      |
|  HERE Geocoding API  | Address to Coordinates   |
| HERE Autosuggest API | Search Autocomplete      |
| Google Geocoding API | Batch Address Resolution |

---

## Repositories

This project is organized into multiple repositories:

|        Repository        | Description                                                    |                                                                    Link                                                                     |
| :----------------------: | -------------------------------------------------------------- | :-----------------------------------------------------------------------------------------------------------------------------------------: |
|  **albatross-frontend**  | Vue.js web application with HERE Maps integration              |  [![Repo](https://img.shields.io/badge/View-Repo-blue?style=flat-square&logo=github)](https://github.com/YOUR_USERNAME/albatross-frontend)  |
| **albatross-cloudflare** | Cloudflare Workers for edge computing and polygon intersection | [![Repo](https://img.shields.io/badge/View-Repo-blue?style=flat-square&logo=github)](https://github.com/YOUR_USERNAME/albatross-cloudflare) |
| **albatross-databricks** | Scala notebooks for Databricks/Delta Lake setup                | [![Repo](https://img.shields.io/badge/View-Repo-blue?style=flat-square&logo=github)](https://github.com/YOUR_USERNAME/albatross-databricks) |
|  **albatross-analysis**  | Python scripts for crime data processing and ML                |  [![Repo](https://img.shields.io/badge/View-Repo-blue?style=flat-square&logo=github)](https://github.com/YOUR_USERNAME/albatross-analysis)  |

---

## Getting Started

### Prerequisites

|                                                  Requirement                                                   | Version           |
| :------------------------------------------------------------------------------------------------------------: | ----------------- |
|    <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white" />    | 18+               |
|     <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" />     | 3.9+              |
| <img src="https://img.shields.io/badge/Cloudflare-F38020?style=flat-square&logo=cloudflare&logoColor=white" /> | Account Required  |
| <img src="https://img.shields.io/badge/Databricks-FF3621?style=flat-square&logo=databricks&logoColor=white" /> | Account Required  |
|       <img src="https://img.shields.io/badge/HERE-00AFAA?style=flat-square&logo=here&logoColor=white" />       | Developer Account |
|     <img src="https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white" />     | API Key           |

### 1. Frontend Setup

```bash
# Clone the frontend repository
git clone https://github.com/YOUR_USERNAME/albatross-frontend.git
cd albatross-frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Add your HERE API key to .env

# Start development server
npm run dev
```

<details>
<summary>Configuration Details</summary>

**Configuration (`src/MapPage.vue` & `src/components/HereMap.vue`):**

```javascript
// Replace with your HERE API key
apiKey: 'YOUR_HERE_API_KEY'
```

</details>

### 2. Cloudflare Workers Setup

```bash
# Clone the cloudflare repository
git clone https://github.com/YOUR_USERNAME/albatross-cloudflare.git
cd albatross-cloudflare

# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy the worker
wrangler deploy
```

<details>
<summary>Worker Files</summary>

| File                 | Purpose                         |
| -------------------- | ------------------------------- |
| `worker.js`          | Main request handler            |
| `polylineDecoder.js` | Flexible polyline decoding      |
| `geometryUtils.js`   | Polygon intersection algorithms |
| `polygonFetcher.js`  | Databricks data fetching        |

</details>

### 3. Data Processing Setup

```bash
# Clone the analysis repository
git clone https://github.com/YOUR_USERNAME/albatross-analysis.git
cd albatross-analysis

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install numpy scikit-learn openai requests polyline

# Set OpenAI API key
export OPENAI_API_KEY='your-api-key'

# Run the analysis pipeline
python analyze.py
```

<details>
<summary>Required Data Files</summary>

```
datafiles/
├── usa.geojson          # US Census block boundaries
├── boston_crime.csv     # Boston crime incidents
├── crime.csv            # Additional crime data
└── final_fast.csv       # Output: processed crime zones
```

</details>

### 4. Databricks Setup

1. Create a Databricks workspace on AWS
2. Upload the Scala notebooks:
   - `Create4gonDeltaLake.scala` - Initialize Delta Lake tables
   - `CrimeDataProcessing.scala` - Process and store crime data
3. Upload crime data CSV to DBFS
4. Run notebooks in order

<details>
<summary>Delta Lake Schema</summary>

```scala
val schema = StructType(Array(
  StructField("vertex1_lat", DoubleType),
  StructField("vertex1_lon", DoubleType),
  StructField("vertex2_lat", DoubleType),
  StructField("vertex2_lon", DoubleType),
  StructField("vertex3_lat", DoubleType),
  StructField("vertex3_lon", DoubleType),
  StructField("vertex4_lat", DoubleType),
  StructField("vertex4_lon", DoubleType),
  StructField("crime_score", DoubleType)
))
```

</details>

---

## How It Works

### Crime Zone Generation

| Step | Process                                                                   |
| :--: | ------------------------------------------------------------------------- |
|  1   | **Data Ingestion** - Crime data loaded from CSV files                     |
|  2   | **Geocoding** - Addresses converted to coordinates via Google API         |
|  3   | **Block Assignment** - Crimes assigned to census blocks using ray-casting |
|  4   | **Severity Scoring** - OpenAI embeddings + cosine similarity              |
|  5   | **Zone Classification** - Ranked by crime density into 5 levels           |
|  6   | **Polygon Simplification** - K-Means clustering to 4-sided N-gons         |

### Danger Levels

| Level | Percentile | Risk           |
| :---: | :--------: | -------------- |
| **5** |   Top 2%   | Most dangerous |
| **4** |   Top 5%   | Very dangerous |
| **3** |  Top 10%   | Dangerous      |
| **2** |  Top 50%   | Moderate risk  |
| **1** | Bottom 50% | Low risk       |

### Route Calculation

1. User enters origin and destination
2. Initial route calculated via HERE Routing API
3. Polyline sent to Cloudflare Worker
4. Worker checks intersections with crime zones
5. Matching danger zones returned to frontend
6. Route recalculated with `avoid[areas]` parameter
7. Safe route displayed with crime zones visualized

---

## Future Roadmap

- [ ] **Real-time Notifications** - Push alerts for nearby incidents
- [ ] **Personalized Safety** - User-specific risk preferences
- [ ] **AI Crime Prediction** - Predictive models for emerging hot-zones
- [ ] **Mobile Apps** - Native iOS and Android applications
- [ ] **Community Reports** - Crowdsourced safety data
- [ ] **Time-based Routing** - Different routes for day vs. night
- [ ] **911 Integration** - Emergency service coordination

---

## Accomplishments

- Completed all core functionalities within hackathon timeframe
- Successfully integrated multiple new technologies (Databricks, Cloudflare Workers)
- Built efficient real-time crime data clustering system
- Implemented flexible polyline encoding workarounds
- Created scalable architecture for future enhancements

---

## What We Learned

|         Technology          | Learnings                                        |
| :-------------------------: | ------------------------------------------------ |
| **Databricks & Delta Lake** | Unified analytics platform and ACID transactions |
|   **Cloudflare Workers**    | Edge computing for low-latency processing        |
|        **HERE APIs**        | Geo-routing and flexible polyline encoding       |
|         **Vue.js**          | Reactive frontend development                    |
|      **Scala & Spark**      | Distributed data processing                      |
|      **ML Embeddings**      | Text similarity for crime classification         |

---

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

```bash
# 1. Fork the repository
# 2. Create your feature branch
git checkout -b feature/AmazingFeature

# 3. Commit your changes
git commit -m 'Add some AmazingFeature'

# 4. Push to the branch
git push origin feature/AmazingFeature

# 5. Open a Pull Request
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Team

<p align="center">
  <strong>HackHarvard 2024</strong>
</p>

<table align="center">
  <tr>
    <td align="center">
      <a href="https://github.com/Shahir-47">
        <img src="https://github.com/Shahir-47.png" width="100px;" alt="Shahir Ahmed"/><br />
        <sub><b>Shahir Ahmed</b></sub>
      </a><br />
      <sub>Full Stack</sub>
    </td>
    <td align="center">
      <a href="https://github.com/boosungkim">
        <img src="https://github.com/boosungkim.png" width="100px;" alt="Boosung Kim"/><br />
        <sub><b>Boosung Kim</b></sub>
      </a><br />
      <sub>Full Stack</sub>
    </td>
    <td align="center">
      <a href="https://github.com/zedeckj">
        <img src="https://github.com/zedeckj.png" width="100px;" alt="Jordan Zedeck"/><br />
        <sub><b>Jordan Zedeck</b></sub>
      </a><br />
      <sub>Full Stack</sub>
    </td>
  </tr>
</table>

---

## Acknowledgments

<p align="center">
  <a href="https://developer.here.com/"><img src="https://img.shields.io/badge/HERE-00AFAA?style=for-the-badge&logo=here&logoColor=white" alt="HERE"/></a>
  <a href="https://databricks.com/"><img src="https://img.shields.io/badge/Databricks-FF3621?style=for-the-badge&logo=databricks&logoColor=white" alt="Databricks"/></a>
  <a href="https://workers.cloudflare.com/"><img src="https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare"/></a>
  <a href="https://openai.com/"><img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI"/></a>
</p>

<p align="center">
  Special thanks to <strong>Boston Police Department</strong> for open crime data
</p>

---

<p align="center">
  <strong>Albatross - Because everyone deserves to get home safe.</strong>
</p>

<p align="center">
  <a href="https://devpost.com/software/albatross"><img src="https://img.shields.io/badge/View_on-Devpost-003E54?style=for-the-badge&logo=devpost&logoColor=white" alt="Devpost"/></a>
  <a href="#getting-started"><img src="https://img.shields.io/badge/Get-Started-green?style=for-the-badge" alt="Get Started"/></a>
  <a href="https://github.com/YOUR_USERNAME/albatross-frontend/issues"><img src="https://img.shields.io/badge/Report-Bug-red?style=for-the-badge&logo=github" alt="Report Bug"/></a>
</p>
