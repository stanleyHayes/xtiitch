update plans
set features = features - 'online_ordering'
where code in ('standard', 'growth');
