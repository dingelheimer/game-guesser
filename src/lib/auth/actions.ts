"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error?: string | undefined;
  fieldErrors?: {
    email?: string[] | undefined;
    password?: string[] | undefined;
    username?: string[] | undefined;
  };
};

const usernameField = z
  .string()
  .regex(
    /^[a-zA-Z0-9_]{3,20}$/,
    "Username must be 3–20 characters (letters, numbers, underscores only)",
  );

const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  next: z.string().optional(),
});

const signUpSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: usernameField,
});

const updateUsernameSchema = z.object({
  username: usernameField,
});

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function optionalStr(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Extract error messages for a specific field path from a ZodError. */
function fieldErrors(error: z.ZodError, field: string): string[] | undefined {
  const msgs = error.issues
    .filter((issue) => issue.path[0] === field)
    .map((issue) => issue.message);
  return msgs.length > 0 ? msgs : undefined;
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: str(formData.get("email")),
    password: str(formData.get("password")),
    next: optionalStr(formData.get("next")),
  });

  if (!parsed.success) {
    return {
      fieldErrors: {
        email: fieldErrors(parsed.error, "email"),
        password: fieldErrors(parsed.error, "password"),
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error !== null) {
    return { error: "Invalid email or password. Please try again." };
  }

  redirect(parsed.data.next ?? "/play");
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: str(formData.get("email")),
    password: str(formData.get("password")),
    username: str(formData.get("username")),
  });

  if (!parsed.success) {
    return {
      fieldErrors: {
        email: fieldErrors(parsed.error, "email"),
        password: fieldErrors(parsed.error, "password"),
        username: fieldErrors(parsed.error, "username"),
      },
    };
  }

  const supabase = await createClient();

  // Case-insensitive username uniqueness check before auth signup
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", parsed.data.username)
    .maybeSingle();

  if (existing !== null) {
    return {
      fieldErrors: {
        username: ["This username is already taken. Please choose another."],
      },
    };
  }

  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (signUpError !== null) {
    if (signUpError.message.toLowerCase().includes("already registered")) {
      return { error: "An account with this email already exists." };
    }
    return { error: "Sign-up failed. Please try again." };
  }

  const userId = authData.user?.id;
  if (userId === undefined) {
    return { error: "Sign-up failed. Please try again." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: userId, username: parsed.data.username });

  if (profileError !== null) {
    // Unique constraint violation — username taken by concurrent request
    if (profileError.code === "23505") {
      return {
        fieldErrors: {
          username: ["This username is already taken. Please choose another."],
        },
      };
    }
    return { error: "Failed to create profile. Please try again." };
  }

  redirect("/play");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateUsernameAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updateUsernameSchema.safeParse({
    username: str(formData.get("username")),
  });

  if (!parsed.success) {
    return {
      fieldErrors: { username: fieldErrors(parsed.error, "username") },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError !== null || user === null) {
    return { error: "You must be signed in to update your username." };
  }

  // Check uniqueness, excluding the current user's own username
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", parsed.data.username)
    .neq("id", user.id)
    .maybeSingle();

  if (existing !== null) {
    return {
      fieldErrors: {
        username: ["This username is already taken. Please choose another."],
      },
    };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ username: parsed.data.username })
    .eq("id", user.id);

  if (updateError !== null) {
    if (updateError.code === "23505") {
      return {
        fieldErrors: {
          username: ["This username is already taken. Please choose another."],
        },
      };
    }
    return { error: "Failed to update username. Please try again." };
  }

  return {};
}
