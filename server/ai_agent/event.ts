import { WorkflowEvent } from "@/types";

export class WorkflowEventEmitter {
    listeners = new Map<string, Set<(event: WorkflowEvent) => void>>();

    emit(event: WorkflowEvent) {
        const listeners = this.listeners.get(event.taskId);
        if (listeners) {
            listeners.forEach((listener) => listener(event));
        }
    }

    on(taskId: string, listener: (event: WorkflowEvent) => void) {
        if (!this.listeners.has(taskId)) {
            this.listeners.set(taskId, new Set());
        }
        this.listeners.get(taskId)!.add(listener);

        return () => {
            this.listeners.get(taskId)?.delete(listener);
        };
    }
}