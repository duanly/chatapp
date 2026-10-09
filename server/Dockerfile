FROM node:18-alpine

WORKDIR /app

# 国内服务器可取消注释加速 npm 安装
# RUN npm config set registry https://registry.npmmirror.com

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "src/app.js"]
