alter function public.create_balanced_journal_entry(uuid,text,date,text,uuid,uuid,numeric) security invoker;
alter function public.record_invoice_payment(uuid,numeric,date) security invoker;
