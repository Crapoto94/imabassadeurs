const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'IAmbassadeurs — Charte Éthique IA (Ville d’Ivry-sur-Seine)',
      version: '1.0.0',
      description: "API de la plateforme collaborative d'élaboration de la Charte Éthique IA.",
    },
    servers: [{ url: '/', description: 'Serveur courant' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./modules/**/*.routes.js', './server.js'],
};

module.exports = swaggerJsdoc(options);
