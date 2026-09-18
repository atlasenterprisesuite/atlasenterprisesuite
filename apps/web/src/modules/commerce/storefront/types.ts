export type PublicVariant = {
  id: string;
  product_id: string;
  sku: string;
  title: string;
  currency: string;
  price_minor: string | number;
  state: string;
};

export type PublicMedia = {
  id: string;
  product_id: string;
  variant_id: string | null;
  asset_source: string;
  asset_id: string;
  media_type: string;
  alt_text: string | null;
  sort_order: number;
};

export type PublicProduct = {
  id: string;
  storefront_id: string;
  title: string;
  slug: string;
  description: string | null;
  state: string;
  variants: PublicVariant[];
  media: PublicMedia[];
};

export type PublicStorefront = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  status: string;
};
