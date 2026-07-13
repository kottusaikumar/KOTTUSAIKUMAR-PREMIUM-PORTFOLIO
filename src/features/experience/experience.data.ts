// Work-history entries rendered in the "My Experience" timeline.
import { withBase } from "../../shared/assetPath";

export const EXPERIENCE = [
  {
    company: "Vajra.ai",
    role: "Data Science Intern",
    period: "NOV 2024 — FEB 2025",
    logo: withBase("/images/branding/vajra-logo.png"),
    description:
      "Developed a full-stack AI chatbot application combining computer vision and NLP, including a VGG19-based CNN for food spoilage detection that achieved 94% accuracy, and an LSTM-based chatbot for customer service automation. Built a deep learning pipeline using transfer learning with VGG19, applied data augmentation and fine-tuning on a custom dataset of 5,000+ food images to improve model performance and generalization. Designed and implemented a scalable web application with a React.js frontend and Flask REST API backend, enabling real-time image classification and conversational AI features, and deployed TensorFlow models in a production-ready setup.Implemented an encoder–decoder LSTM model trained on 1000+ question–answer pairs, enhancing chatbot responses and contextual understanding.",
  },
  {
    company: "Vajra.ai",
    role: "Data Science Intern",
    period: "AUG 2024 — OCT 2024",
    logo: withBase("/images/branding/vajra-logo.png"),
    description:
      "Built an end-to-end machine learning pipeline to predict drug effectiveness using Random Forest, trained on 2,000+ patient records, achieving an R² score of 0.81 and RMSE of 0.38. Cleaned and prepared data by handling missing values, outliers, categorical variables, and feature scaling, and applied cross-validation to ensure reliable model performance. Compared multiple regression models including Linear Regression, Ridge, Lasso, XGBoost, and Random Forest, and selected the best model based on performance metrics.Supported clinical analytics validation by contributing to reports and SOP documentation, following data science best practices.",
  },
];
