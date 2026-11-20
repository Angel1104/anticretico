import styles from "./Button.module.css";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const variantClass = styles[`v_${variant}`] ?? "";
  const sizeClass = styles[`s_${size}`] ?? "";
  return (
    <button
      className={`${styles.btn} ${variantClass} ${sizeClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
