import { Route, Routes } from 'react-router-dom';
import { CommerceHomePage } from './CommerceHomePage';
import { OrderDetailPage } from './OrderDetailPage';
import { OrdersPage } from './OrdersPage';
import { ProductsPage } from './ProductsPage';
import './commerce.css';

export function CommerceRoutes() {
  return (
    <Routes>
      <Route path="/commerce" element={<CommerceHomePage />} />
      <Route path="/commerce/products" element={<ProductsPage />} />
      <Route path="/commerce/orders" element={<OrdersPage />} />
      <Route path="/commerce/orders/:id" element={<OrderDetailPage />} />
    </Routes>
  );
}
