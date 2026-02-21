FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Environment variable to determine API endpoint
ENV NEXT_PUBLIC_API_MODE=local

EXPOSE 3000

CMD ["npm", "run", "dev"]
