-- Mostra a definição exata da regra que está bloqueando o cadastro de documento
select conname, pg_get_constraintdef(oid) as regra
from pg_constraint
where conname = 'documents_type_chk';
