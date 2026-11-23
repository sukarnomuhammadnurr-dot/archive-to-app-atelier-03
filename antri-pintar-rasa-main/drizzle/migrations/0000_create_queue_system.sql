CREATE TYPE public.app_role AS ENUM ('staff', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = _user_id AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.queue_counters (
  service_type text NOT NULL CHECK (service_type IN ('NPP', 'BP', 'HR', 'BPJS')),
  queue_day date NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (service_type, queue_day)
);
GRANT ALL ON public.queue_counters TO service_role;
ALTER TABLE public.queue_counters ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_number text NOT NULL,
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 2 AND 120),
  customer_id text NOT NULL CHECK (char_length(customer_id) BETWEEN 4 AND 32),
  service_type text NOT NULL CHECK (service_type IN ('NPP', 'BP', 'HR', 'BPJS')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'completed')),
  queue_day date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date),
  created_at timestamptz NOT NULL DEFAULT now(),
  called_at timestamptz,
  completed_at timestamptz,
  UNIQUE (service_type, queue_day, queue_number)
);
GRANT INSERT (customer_name, customer_id, service_type) ON public.queues TO anon, authenticated;
GRANT SELECT (id, queue_number, service_type, status, queue_day, created_at, called_at, completed_at) ON public.queues TO anon;
GRANT SELECT, UPDATE (status, called_at, completed_at) ON public.queues TO authenticated;
GRANT ALL ON public.queues TO service_role;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_queue_completed(_queue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.queues WHERE id = _queue_id AND status = 'completed');
$$;
GRANT EXECUTE ON FUNCTION public.is_queue_completed(uuid) TO anon, authenticated;

CREATE POLICY "Public can create queue tickets" ON public.queues FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can read tickets by id" ON public.queues FOR SELECT TO anon USING (true);
CREATE POLICY "Staff and admins can read all tickets" ON public.queues FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff and admins can update queue status" ON public.queues FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL UNIQUE REFERENCES public.queues(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT (queue_id, rating, comment) ON public.feedbacks TO anon, authenticated;
GRANT SELECT ON public.feedbacks TO authenticated;
GRANT ALL ON public.feedbacks TO service_role;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can review completed tickets" ON public.feedbacks FOR INSERT TO anon, authenticated WITH CHECK (public.is_queue_completed(queue_id));
CREATE POLICY "Admins can read feedback" ON public.feedbacks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.assign_queue_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
  prefix text;
BEGIN
  NEW.queue_day := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  NEW.status := 'waiting';
  NEW.called_at := NULL;
  NEW.completed_at := NULL;
  CASE NEW.service_type
    WHEN 'NPP' THEN prefix := 'A';
    WHEN 'BP' THEN prefix := 'B';
    WHEN 'HR' THEN prefix := 'H';
    WHEN 'BPJS' THEN prefix := 'J';
  END CASE;
  INSERT INTO public.queue_counters (service_type, queue_day, last_number)
  VALUES (NEW.service_type, NEW.queue_day, 1)
  ON CONFLICT (service_type, queue_day)
  DO UPDATE SET last_number = public.queue_counters.last_number + 1
  RETURNING last_number INTO next_number;
  NEW.queue_number := prefix || '-' || lpad(next_number::text, 3, '0');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_queue_number() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER set_queue_number BEFORE INSERT ON public.queues FOR EACH ROW EXECUTE FUNCTION public.assign_queue_number();

ALTER PUBLICATION supabase_realtime ADD TABLE public.queues;