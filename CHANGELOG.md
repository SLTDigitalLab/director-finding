# Changes Documentation

## Overview of Changes
This document summarizes the major changes made to the Director Registry System. It serves as a guide for future developers to understand the modifications and current functionalities of the system.

## Backend Changes
### Functionalities Added
- **Director Management**:
  - Implemented add, update, and delete functionalities for directors.
  - Included methods for linking directors to companies.
  - Integrated mechanisms for managing blacklisting and whitelisting of directors.

- **Company Management**:
  - Added capabilities for creating and modifying company details.
  - Implemented connections between companies and directors.

- **PDF Extraction**:
  - Developed functionality for extracting company and director information from uploaded PDF files using AI models (OpenAI and Gemini).

- **Validation Mechanisms**:
  - Introduced validation processes for director details against a blacklist during form submissions.

### Database Models
- **Director**:
  - Attributes include `id`, `full_name`, `nic_passport`, `is_blacklisted`, etc.
  - Relationships with other models established.

- **Company**:
  - Attributes such as `id`, `name`, `is_blacklisted`, etc.
  - Direct associations with directors.

- **Additional Models**: 
  - Including blacklisted and related companies for enhanced functionalities.

### API Endpoints
- `/api/directors`
  - **GET**: List all directors.
  - **POST**: Create a new director.
  - **PATCH**: Update an existing director.
  - **DELETE**: Remove a director.

- `/api/companies`
  - **GET**: List all companies.
  - **POST**: Create a new company.
  - **PATCH**: Update an existing company.
  - **DELETE**: Remove a company.

- `/api/extract-pdf`
  - **POST**: Extract data from a PDF file.

## Frontend Changes
### Utility Enhancements
- **constants.js**:
  - Added constants for API base URL and authentication settings.

### Authentication Logic
- **auth.js**:
  - Implemented functions for handling user authentication, including a method for building an authentication URL and managing session storage.

### Configuration Files
- **vite.config.js**:
  - Configured development server settings including proxy for API requests.
- **tailwind.config.js**:
  - Customized theme settings for Tailwind CSS styles.
- **postcss.config.js**:
  - Integrated Tailwind CSS and Autoprefixer in the PostCSS configuration.

## Conclusion
This document provides an overview of the changes made in both backend and frontend components of the Director Registry System. It is essential for the continuity of development and maintenance of the project, ensuring clarity and understanding for future developers.