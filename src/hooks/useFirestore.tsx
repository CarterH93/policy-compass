import { useReducer, useEffect, useState } from "react";
import { db, timestamp } from "../firebase/config";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";

interface FirestoreState {
  document: any | null;
  isPending: boolean;
  error: string | null;
  success: boolean | null;
}

type FirestoreAction =
  | { type: "IS_PENDING" }
  | { type: "ADDED_DOCUMENT"; payload: any }
  | { type: "DELETED_DOCUMENT" }
  | { type: "ERROR"; payload: string }
  | { type: "UPDATED_DOCUMENT"; payload: any };

const initialState: FirestoreState = {
  document: null,
  isPending: false,
  error: null,
  success: null,
};

const firestoreReducer = (
  state: FirestoreState,
  action: FirestoreAction
): FirestoreState => {
  switch (action.type) {
    case "IS_PENDING":
      return { isPending: true, document: null, success: false, error: null };
    case "ADDED_DOCUMENT":
      return {
        isPending: false,
        document: action.payload,
        success: true,
        error: null,
      };
    case "DELETED_DOCUMENT":
      return { isPending: false, document: null, success: true, error: null };
    case "ERROR":
      return {
        isPending: false,
        document: null,
        success: false,
        error: action.payload,
      };
    case "UPDATED_DOCUMENT":
      return {
        isPending: false,
        document: action.payload,
        success: true,
        error: null,
      };
    default:
      return state;
  }
};



export interface UseFirestoreReturn {
  addDocument: (doc: Record<string, any>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  updateDocument: (id: string, updates: Record<string, any>) => Promise<void>;
  response: FirestoreState;
}
/**
 * Custom React hook for interacting with a Firestore collection.
 *
 * @param {string} col - The name of the Firestore collection to interact with.
 * @returns {{
 *   addDocument: (doc: Object) => Promise<void>,
 *   deleteDocument: (id: string) => Promise<void>,
 *   updateDocument: (id: string, updates: Object) => Promise<void>,
 *   response: Object
 * }} Object conatining ways to interact with the Firestore collection and the current response state. Use response.error to get any errors.
 *
 * @example
 * import { useFirestore } from "../../hooks/useFirestore";

export default function Home() {
  // Main function that adds new document
  const { addDocument, response } = useFirestore("carterdocs");
  function handleClick() {
    const doc = { title: "New Document", content: "This is a new document." };
    addDocument(doc);
  }

  return (
    <div>
      <button className="btn" onClick={handleClick}>
        Click Me
      </button>
      {response.error && <div className="error">{response.error}</div>}
      {response.isPending && <div className="loading">Loading...</div>}
      {response.success && (
        <div className="success">Document added successfully!</div>
      )}
    </div>
  );
}
 */
export const useFirestore = (col: string): UseFirestoreReturn => {
  const [response, dispatch] = useReducer(firestoreReducer, initialState);
  const [isCancelled, setIsCancelled] = useState(false);

  // collection ref
  const ref = collection(db, col);

  // only dispatch if not cancelled
  const dispatchIfNotCancelled = (action: FirestoreAction) => {
    if (!isCancelled) {
      dispatch(action);
    }
  };

  // add a document
  const addDocument = async (doc: Record<string, any>): Promise<void> => {
    dispatch({ type: "IS_PENDING" });

    try {
      const createdAt = timestamp.fromDate(new Date());
      const addedDocument = await addDoc(ref, { ...doc, createdAt });
      dispatchIfNotCancelled({
        type: "ADDED_DOCUMENT",
        payload: addedDocument,
      });
    } catch (err: any) {
      dispatchIfNotCancelled({ type: "ERROR", payload: err.message });
    }
  };

  // delete a document
  const deleteDocument = async (id: string): Promise<void> => {
    dispatch({ type: "IS_PENDING" });

    try {
      await deleteDoc(doc(db, col, id));
      dispatchIfNotCancelled({ type: "DELETED_DOCUMENT" });
    } catch (err) {
      dispatchIfNotCancelled({ type: "ERROR", payload: "could not delete" });
    }
  };

  // update a document
  const updateDocument = async (
    id: string,
    updates: Record<string, any>
  ): Promise<void> => {
    dispatch({ type: "IS_PENDING" });

    try {
      const updatedDocument = await updateDoc(doc(db, col, id), updates);
      dispatchIfNotCancelled({
        type: "UPDATED_DOCUMENT",
        payload: updatedDocument,
      });
    } catch (error: any) {
      dispatchIfNotCancelled({ type: "ERROR", payload: error.message });
    }
  };

  useEffect(() => {
    return () => setIsCancelled(true);
  }, []);

  return { addDocument, deleteDocument, updateDocument, response };
};
