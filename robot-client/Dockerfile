FROM node:18-alpine

WORKDIR /app

# 国内服务器可取消注释加速 npm 安装
# RUN npm config set registry https://registry.npmmirror.com

# 安装依赖
COPY package*.json ./
RUN npm install --production

# 复制源码
COPY . .

EXPOSE 7777

CMD ["node", "index.js"]
