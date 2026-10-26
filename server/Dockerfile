FROM node:22-alpine
WORKDIR /app
COPY core/png.js core/png.js
COPY server/skin-service.js server/skin-service.js
ENV PORT=8787 DATA=/data TRUST_PROXY=1
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "server/skin-service.js"]
