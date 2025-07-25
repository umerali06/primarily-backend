# Inventory Management Backend API

A comprehensive, production-ready inventory management system backend built with Node.js, Express, and MongoDB. This API provides complete functionality for managing inventory items, folders, users, permissions, alerts, and more.

## 🚀 Features

### Core Functionality

- **User Management**: Registration, authentication, profile management
- **Item Management**: CRUD operations, image uploads, quantity tracking
- **Folder Management**: Hierarchical organization with unlimited nesting
- **Alert System**: Automatic low-stock alerts and custom notifications
- **Activity Tracking**: Comprehensive audit logs for all user actions
- **Permission System**: Role-based access control with granular permissions
- **Search & Filter**: Advanced search with multiple criteria and pagination
- **Data Export/Import**: CSV and JSON export/import with validation

### Security & Performance

- **Authentication**: JWT tokens + Google OAuth integration
- **Authorization**: Permission-based access control
- **Security**: Helmet, CORS, rate limiting, input validation
- **Logging**: Comprehensive request and error logging
- **Monitoring**: Health checks and system metrics
- **Caching**: Redis integration for improved performance

### Developer Experience

- **API Documentation**: Complete Swagger/OpenAPI documentation
- **Testing**: Unit tests, integration tests, and test coverage
- **Development Tools**: Hot reload, linting, debugging support
- **Deployment**: Docker containerization with production configurations

## 🏗️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT + Passport.js (Google OAuth)
- **File Storage**: Multer with image processing
- **Documentation**: Swagger UI + OpenAPI 3.0
- **Testing**: Jest + Supertest
- **Deployment**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Monitoring**: Winston logging + Health checks

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB (v5.0 or higher)
- Redis (optional, for caching)
- Docker & Docker Compose (for containerized deployment)

## 🛠️ Installation & Setup

### Local Development

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd inventory-management-backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**

   ```bash
   cp .env.example .env
   ```

   Update the `.env` file with your configuration:

   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/inventory_management
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-super-secret-refresh-key
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

4. **Database Setup**

   ```bash
   # Test database connection
   npm run db:test

   # Initialize database with indexes
   npm run db:init
   ```

5. **Start Development Server**

   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:5000`

### Docker Deployment

1. **Development Environment**

   ```bash
   npm run docker:build
   npm run docker:run
   ```

2. **Production Environment**
   ```bash
   ./scripts/deploy.sh production
   ```

## 📚 API Documentation

### Interactive Documentation

- **Swagger UI**: `http://localhost:5000/api-docs`
- **Health Check**: `http://localhost:5000/health`
- **API Base URL**: `http://localhost:5000/api`

### Postman Collection

Import the Postman collection from `/postman/Inventory-Management-API.postman_collection.json` for easy API testing.

### Key Endpoints

#### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/google` - Google OAuth login
- `POST /api/auth/refresh-token` - Refresh JWT token
- `GET /api/auth/me` - Get current user

#### Items

- `GET /api/items` - List items with filtering
- `POST /api/items` - Create new item
- `GET /api/items/:id` - Get item details
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item
- `GET /api/items/search` - Advanced search
- `POST /api/items/:id/images` - Upload item images

#### Folders

- `GET /api/folders` - List folders
- `POST /api/folders` - Create folder
- `GET /api/folders/hierarchy` - Get folder tree
- `PUT /api/folders/:id/move` - Move folder

#### Export/Import

- `GET /api/export/items/csv` - Export items to CSV
- `GET /api/export/complete` - Export complete inventory
- `POST /api/import/items/csv` - Import items from CSV
- `POST /api/import/validate` - Validate import file

## 🧪 Testing

### Run Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Test coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Structure

- **Unit Tests**: `/src/tests/*.test.js`
- **Integration Tests**: `/src/tests/integration/*.test.js`
- **Coverage Reports**: `/coverage/`

## 🚀 Deployment

### Environment Configurations

#### Development

```bash
npm run dev
```

#### Production

```bash
# Using Docker
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Using deployment script
./scripts/deploy.sh production
```

### CI/CD Pipeline

The project includes a complete GitHub Actions workflow:

- **Testing**: Automated unit and integration tests
- **Security**: Dependency auditing and security checks
- **Building**: Docker image creation and registry push
- **Deployment**: Automated production deployment
- **Monitoring**: Health checks and notifications

## 🔒 Security Features

- **Authentication**: JWT with refresh tokens
- **Authorization**: Role-based permissions
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API endpoint protection
- **CORS**: Cross-origin request handling
- **Helmet**: Security headers
- **Audit Logging**: Complete activity tracking

## 📊 Monitoring & Logging

### Health Monitoring

- **Health Check**: `GET /health`
- **System Metrics**: `GET /api/admin/metrics` (admin only)
- **Application Logs**: Winston logging with rotation

### Performance Monitoring

- Request/response time tracking
- Database query performance
- Memory and CPU usage monitoring
- Error rate tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Ensure all tests pass
- Follow semantic versioning

## 📄 API Response Format

All API responses follow a consistent format:

```json
{
  "status": 200,
  "message": "Success message",
  "data": {
    // Response data
  }
}
```

Error responses:

```json
{
  "status": 400,
  "message": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Error details
  }
}
```

## 📜 License

This project is licensed under the MIT License.

---

**Built with ❤️ using Node.js, Express, and MongoDB**
