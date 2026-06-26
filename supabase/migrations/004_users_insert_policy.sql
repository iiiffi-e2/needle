-- Allow authenticated users to create their own profile row if the signup trigger missed it.
CREATE POLICY "Users can insert own profile"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);
