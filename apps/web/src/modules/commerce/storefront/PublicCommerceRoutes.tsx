import { Route, Routes } from 'react-router-dom';
import { PublicCartPage } from './PublicCartPage';
import { PublicProductPage } from './PublicProductPage';
import { PublicStorefrontPage } from './PublicStorefrontPage';
import './storefront.css';

export function PublicCommerceRoutes() {
  return (
    <Routes>
      <Route path="/shop/:storefrontSlug" element={<PublicStorefrontPage />} />
      <Route path="/shop/:storefrontSlug/products/:productSlug" element={<PublicProductPage />} />
      <Route path="/shop/:storefrontSlug/cart" element={<PublicCartPage />} />
    </Routes>
  );
}
