FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_API_BASE_URL=https://novel-saas-backend-254626-5-1251397349.sh.run.tcloudbase.com
RUN npm run build
CMD npx vite preview --port ${PORT:-3000} --host 0.0.0.0
