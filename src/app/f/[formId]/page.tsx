import { notFound } from "next/navigation";
import { resolvePublicForm } from "@/app/actions/forms";
import { PublicFormRenderer } from "./PublicFormRenderer";

interface Props {
    params: Promise<{ formId: string }>;
}

export default async function PublicFormPage({ params }: Props) {
    const { formId } = await params;
    const form = await resolvePublicForm(formId);
    if (!form) return notFound();

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex items-start justify-center p-6 pt-12">
            <div className="bg-white rounded-3xl shadow-xl max-w-xl w-full overflow-hidden">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100">
                    <div className="text-[10px] font-black text-[#0051e6] uppercase tracking-wider mb-2">Request form</div>
                    <h1 className="text-2xl font-black text-[#1d1d1f]">{form.name}</h1>
                    {form.description && (
                        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{form.description}</p>
                    )}
                </div>

                <PublicFormRenderer form={form} />
            </div>
        </div>
    );
}
