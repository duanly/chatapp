FROM node:18-alpine AS build
ARG VITE_BASE_PATH=/
WORKDIR /app

# 国内服务器可取消注释加速 npm 安装
# RUN npm config set registry https://registry.npmmirror.com

COPY package*.json ./
RUN npm ci
COPY . .
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
