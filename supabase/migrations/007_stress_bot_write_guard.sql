-- Prevent non-service-role clients from setting or clearing is_stress_bot.
-- Authenticated profile updates that touch other columns keep the prior flag.

CREATE OR REPLACE FUNCTION public.guard_is_stress_bot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
      NEW.is_stress_bot := FALSE;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.is_stress_bot := OLD.is_stress_bot;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_is_stress_bot ON public.users;

CREATE TRIGGER users_guard_is_stress_bot
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_is_stress_bot();
