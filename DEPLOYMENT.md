# 🚀 Deployment Guide for HealthCare Assistant

## Azure App Service Deployment

### Prerequisites
- Azure subscription
- Azure CLI installed locally

### 1. Prepare for Deployment
```bash
# Install Azure CLI (if not already installed)
# Windows: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-windows
# macOS: brew install azure-cli
# Linux: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login
```

### 2. Create Azure Resources
```bash
# Set variables (replace with your preferred names)
RESOURCE_GROUP="rg-healthcare-assistant"
APP_NAME="healthcare-assistant-app"
LOCATION="eastus"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create App Service plan
az appservice plan create --name "$APP_NAME-plan" --resource-group $RESOURCE_GROUP --sku B1 --is-linux

# Create web app
az webapp create --resource-group $RESOURCE_GROUP --plan "$APP_NAME-plan" --name $APP_NAME --runtime "PYTHON|3.11"
```

### 3. Configure Environment Variables
```bash
# Set your Azure OpenAI credentials
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings \
    AZURE_OPENAI_API_KEY="your_actual_api_key" \
    AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/" \
    ASSISTANT_ID="asst_your_assistant_id"
```

### 4. Deploy Application
```bash
# Create deployment package
zip -r healthcare-assistant.zip . -x "*.git*" "__pycache__/*" "*.pyc" ".env"

# Deploy to Azure
az webapp deploy --resource-group $RESOURCE_GROUP --name $APP_NAME --src-path healthcare-assistant.zip --type zip
```

## Docker Deployment

### Create Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
```

### Build and Run
```bash
# Build Docker image
docker build -t healthcare-assistant .

# Run container
docker run -p 5000:5000 --env-file .env healthcare-assistant
```

## Environment Variables for Production

Create a `.env.production` file:
```env
AZURE_OPENAI_API_KEY=your_production_api_key
AZURE_OPENAI_ENDPOINT=https://your-production-resource.openai.azure.com/
ASSISTANT_ID=asst_your_production_assistant_id
FLASK_ENV=production
FLASK_DEBUG=False
```

## Security Checklist for Production

- [ ] Use production Azure OpenAI credentials
- [ ] Set `FLASK_DEBUG=False`
- [ ] Enable HTTPS/SSL certificates  
- [ ] Configure proper CORS origins
- [ ] Set up monitoring and logging
- [ ] Implement rate limiting
- [ ] Add authentication if required
- [ ] Regular security updates

## Monitoring & Analytics

### Application Insights Integration
```python
# Add to app.py for production monitoring
from azure.monitor.opentelemetry.exporter import AzureMonitorTraceExporter
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

# Configure Application Insights
if os.getenv('APPLICATIONINSIGHTS_CONNECTION_STRING'):
    trace.set_tracer_provider(TracerProvider())
    tracer = trace.get_tracer(__name__)
    
    exporter = AzureMonitorTraceExporter(
        connection_string=os.getenv('APPLICATIONINSIGHTS_CONNECTION_STRING')
    )
    
    span_processor = BatchSpanProcessor(exporter)
    trace.get_tracer_provider().add_span_processor(span_processor)
```

## Cost Optimization Tips

1. **Azure OpenAI**: Monitor token usage and set spending limits
2. **App Service**: Use appropriate pricing tier (B1 for development, S1+ for production)
3. **Vector Store**: Optimize document size and chunking strategy
4. **Caching**: Implement response caching for common queries

## Troubleshooting

### Common Issues
- **500 Error**: Check environment variables are set correctly
- **API Timeout**: Increase timeout limits in Azure App Service
- **CORS Issues**: Update CORS configuration for your domain
- **Assistant Not Found**: Verify Assistant ID and permissions

### Debug Commands
```bash
# View app logs
az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME

# SSH into container (for troubleshooting)
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME
```