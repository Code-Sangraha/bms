"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { usePermissions } from "@/app/providers/AuthProvider";
import { createRole as createRoleApi } from "@/handlers/role";
import { createRoleSchema, type CreateRoleFormValues } from "@/schema/role";
import "./createRole.scss";

const ROLES_QUERY_KEY = ["roles"];
const defaultValues: CreateRoleFormValues = {
  name: "",
};

export default function CreateRolePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canCreate } = usePermissions();

  useEffect(() => {
    if (canCreate === false) {
      router.replace("/dashboard/accounts/roles");
    }
  }, [canCreate, router]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoleFormValues>({
    resolver: zodResolver(createRoleSchema),
    defaultValues,
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateRoleFormValues) =>
      createRoleApi({ name: values.name }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
        router.push("/dashboard/accounts/roles");
      } else {
        if (result.status === 401) {
          router.push("/login");
          return;
        }
        setError("root", { message: result.error });
      }
    },
    onError: () => {
      setError("root", { message: "Something went wrong. Please try again." });
    },
  });

  const onSubmit = (data: CreateRoleFormValues) => {
    createMutation.mutate(data);
  };

  const loading = isSubmitting || createMutation.isPending;

  if (canCreate === false) {
    return null;
  }

  return (
    <section className="createRolePage">
      <div className="breadcrumb">
        <span>Accounts</span> {"›"} <span>Roles</span> {"›"} Create role
      </div>

      <div className="createRoleHeader">
        <h1 className="pageTitle">Create role</h1>
        <p className="pageSubtitle">
          Add a new role to assign to users (e.g. Employee, Manager).
        </p>
      </div>

      <div className="createRoleCard">
        <form
          className="createRoleForm"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          {errors.root?.message && (
            <p className="createRoleFormError" role="alert">
              {errors.root.message}
            </p>
          )}
          <label className="modalField">
            <span className="label">Role name</span>
            <input
              className="input"
              placeholder="e.g. Employee"
              {...register("name")}
              autoFocus
            />
            {errors.name && (
              <span className="createRoleFieldError">
                {errors.name.message}
              </span>
            )}
          </label>
          <div className="createRoleActions">
            <button
              type="submit"
              className="button buttonPrimary"
              disabled={loading}
            >
              {loading ? "Creating…" : "Create role"}
            </button>
            <Link href="/dashboard/accounts/roles" className="cancelLink">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
