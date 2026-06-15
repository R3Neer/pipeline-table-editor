import type { AppElements } from "../../ui/dom";

export interface ModalController {
  showConfirm(title: string, message: string, acceptText?: string): Promise<boolean>;
  showNotice(title: string, message: string): Promise<boolean>;
  closeConfirmModal(value: boolean): void;
}

export function createModalController(elements: AppElements): ModalController {
  let confirmResolver: ((value: boolean) => void) | null = null;

  function showConfirm(title: string, message: string, acceptText = "Continue"): Promise<boolean> {
    closeConfirmModal(false);
    elements.confirmModalTitle.textContent = title;
    elements.confirmModalMessage.textContent = message;
    elements.acceptConfirmBtn.textContent = acceptText;
    elements.cancelConfirmBtn.hidden = false;
    elements.confirmModal.classList.add("is-warning");
    elements.confirmModal.setAttribute("aria-hidden", "false");
    window.setTimeout(() => elements.cancelConfirmBtn.focus(), 0);
    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  }

  function showNotice(title: string, message: string): Promise<boolean> {
    closeConfirmModal(false);
    elements.confirmModalTitle.textContent = title;
    elements.confirmModalMessage.textContent = message;
    elements.acceptConfirmBtn.textContent = "OK";
    elements.cancelConfirmBtn.hidden = true;
    elements.confirmModal.classList.remove("is-warning");
    elements.confirmModal.setAttribute("aria-hidden", "false");
    window.setTimeout(() => elements.acceptConfirmBtn.focus(), 0);
    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  }

  function closeConfirmModal(value: boolean): void {
    elements.confirmModal.setAttribute("aria-hidden", "true");
    if (confirmResolver) {
      const resolve = confirmResolver;
      confirmResolver = null;
      resolve(value);
    }
  }

  return { showConfirm, showNotice, closeConfirmModal };
}


