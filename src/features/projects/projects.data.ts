// Source-of-truth content for the "My Projects" card grid.
// Each entry drives one card: video thumbnail, title, meta tags,
// the one-line "highlight" stat, and the outbound GitHub link.
import { withBase } from "../../shared/assetPath";

export const PROJECTS = [
  {
    id: "01",
    name: "AI Resume Screening System",
    category: "NLP Ranking · TF-IDF · BM25 · Skill Matching",
    focus: "NLP Ranking",
    highlight: "Semantic Candidate Match Scoring",
    description:
      "A recruiter-focused screening engine that compares resumes with job descriptions using TF-IDF, BM25, cosine similarity, n-grams, fuzzy matching, synonym mapping, and missing-skill recommendations. The new visual direction treats it like a premium candidate intelligence console rather than a normal dashboard screenshot.",
    video: withBase("/projects/videos/resume-screening.mp4"),
    link: "https://github.com/kottusaikumar/AI-Resume-Screening-System",
  },
  {
    id: "02",
    name: "Food Spoilage Detection Chatbot",
    category: "CNN · NLP · VGG19 · Encoder-Decoder LSTM",
    focus: "Computer Vision + NLP",
    highlight: "Dual-Model Customer Service Chatbot",
    description:
      "An intelligent customer-service chatbot that fuses computer vision and NLP: a VGG19-based CNN classifies uploaded food images as fresh or spoiled, while an encoder-decoder LSTM with attention handles natural-language customer queries and drives automated refund recommendations. A React chat interface talks to a Flask API exposing /api/chat, /api/classify, and /api/health endpoints, with image upload, real-time responses, and full error handling.",
    video: withBase("/projects/videos/food-spoilage-chatbot.mp4"),
    link: "https://github.com/kottusaikumar/AI-Chatbot-Project-Intelligent-Food-Spoilage-Detector-CNN-NLP-",
  },
  {
    id: "03",
    name: "Hybrid RAG Document Assistant",
    category: "RAG · FAISS/BM25 · LangChain · Production Chatbot",
    focus: "RAG",
    highlight: "Hybrid Semantic + Keyword Retrieval",
    description:
      "A document assistant concept built around hybrid retrieval: dense semantic search plus sparse keyword matching, then answer synthesis over grounded context. The project card now uses a document-to-vector-to-answer visual metaphor so recruiters instantly understand the AI workflow.",
    video: withBase("/projects/videos/rag-assistant.mp4"),
    link: "https://github.com/kottusaikumar/Hybrid-RAG-Document-Assistant-Production-Chatbot-",
  },
  {
    id: "04",
    name: "Weapon Detection & Identification",
    category: "Computer Vision · VGG19 · Custom CNN · Streamlit",
    focus: "Computer Vision",
    highlight: "VGG19 + Custom CNN Classifier",
    description:
      "A computer-vision app for classifying weapon categories using deep learning models including VGG19 and a custom CNN, delivered through a Streamlit upload/classification workflow. The new image uses a tactical scanning interface to visually reinforce the classification theme.",
    video: withBase("/projects/videos/weapon-detection.mp4"),
    link: "https://github.com/kottusaikumar/weapons-Detection-identification-using-Image-Recognition",
  },
  {
    id: "05",
    name: "TradePro Analytics Dashboard",
    category: "Flask · Plotly · Technical Indicators · Market UI",
    focus: "Flask",
    highlight: "OHLC Charting · VWAP · EMA · RSI",
    description:
      "A trading analytics dashboard with interactive multi-pane charts, CSV/RAR local data handling, OHLC transformations, and indicators such as VWAP, EMA, and RSI. The new image gives it a Bloomberg-terminal style premium finance identity.",
    video: withBase("/projects/videos/tradepro-dashboard.mp4"),
    link: "https://github.com/kottusaikumar/Tradepro-Trading-Dashboard",
  },
];
