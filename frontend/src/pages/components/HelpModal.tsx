import React, { useState } from 'react';
import { FaTimes, FaPaperPlane } from 'react-icons/fa';
import '../../styling/HelpModal.scss'; 

interface HelpRequestData {
    problemName: string;
    description: string;
}

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmitRequest: (data: HelpRequestData) => Promise<void>;
    availableProblems?: { id: string; name: string }[]; 
}

const HelpModal: React.FC<HelpModalProps> = ({ 
    isOpen, 
    onClose, 
    onSubmitRequest,
    availableProblems = [] 
}) => {
    const [problemName, setProblemName] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    // If the modal isn't open, don't render anything
    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!problemName || !description.trim()) {
            setError("Please select a problem and describe your issue.");
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmitRequest({ problemName, description });
            setProblemName("");
            setDescription("");
            onClose();
        } catch (err) {
            setError("Failed to send request. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="help-modal-overlay">
            <div className="help-modal" role="dialog" aria-modal="true">
                <div className="help-modal__header">
                    <h2>Request Help from Admins</h2>
                    <button className="help-modal__close" onClick={onClose} aria-label="Close modal">
                        <FaTimes />
                    </button>
                </div>

                <form className="help-modal__form" onSubmit={handleSubmit}>
                    {error && <div className="help-modal__error">{error}</div>}

                    <div className="help-modal__field">
                        <label htmlFor="problem-select">Which problem do you need help with?</label>
                        <select 
                            id="problem-select" 
                            value={problemName} 
                            onChange={(e) => setProblemName(e.target.value)}
                            disabled={isSubmitting}
                        >
                            <option value="" disabled>Select a problem...</option>
                            <option value="general">General System / Environment Issue</option>
                            {availableProblems.map((p) => (
                                <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="help-modal__field">
                        <label htmlFor="issue-description">Describe your question or issue:</label>
                        <textarea 
                            id="issue-description" 
                            rows={5}
                            placeholder=""
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="help-modal__footer">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Sending..." : (
                                <>
                                    <FaPaperPlane style={{ marginRight: "8px" }} />
                                    Submit Request
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default HelpModal;