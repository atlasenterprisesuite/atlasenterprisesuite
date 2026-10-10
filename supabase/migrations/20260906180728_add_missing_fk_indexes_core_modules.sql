create index if not exists idx_education_credentials_org_course_fk on public.education_credentials (org_id, course_id);
create index if not exists idx_education_enrollments_org_learner_fk on public.education_enrollments (org_id, learner_id);
create index if not exists idx_education_results_org_assessment_fk on public.education_results (org_id, assessment_id);
create index if not exists idx_purchase_order_lines_item_fk on public.purchase_order_lines (item_id);
create index if not exists idx_purchase_order_lines_purchase_order_fk on public.purchase_order_lines (purchase_order_id);
create index if not exists idx_purchase_orders_vendor_fk on public.purchase_orders (vendor_id);
create index if not exists idx_sales_order_lines_item_fk on public.sales_order_lines (item_id);
create index if not exists idx_sales_order_lines_sales_order_fk on public.sales_order_lines (sales_order_id);
create index if not exists idx_sales_orders_customer_fk on public.sales_orders (customer_id);
