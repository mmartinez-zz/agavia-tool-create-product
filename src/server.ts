import express from 'express';
import executeRouter from './controllers/execute.controller';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(executeRouter);

app.listen(PORT, () => {
  console.log(`[agavia-products-ms] Running on port ${PORT}`);
});
