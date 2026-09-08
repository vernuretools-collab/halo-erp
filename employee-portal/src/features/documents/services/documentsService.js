import { db, storage } from '../../../shared/services/firebaseService';
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

export const subscribeMyDocuments = (uidOrIds, callback) => {
  const ids = [...new Set((Array.isArray(uidOrIds) ? uidOrIds : [uidOrIds]).filter(Boolean).map(String))]
  if (!ids.length) return () => {}

  const byKey = new Map()
  const unsubs = ids.map((uid) => {
    const q = query(
      collection(db, `documents/${uid}/files`),
      orderBy('uploadedAt', 'desc')
    )
    return onSnapshot(q, (snapshot) => {
      for (const key of [...byKey.keys()]) {
        if (key.startsWith(`${uid}:`)) byKey.delete(key)
      }
      snapshot.docs.forEach((docSnap) => {
        byKey.set(`${uid}:${docSnap.id}`, {
          id: docSnap.id,
          ownerUserId: uid,
          ...docSnap.data(),
        })
      })
      const docs = [...byKey.values()].sort((a, b) => {
        const timeA = a.uploadedAt?.toMillis?.() || (a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0)
        const timeB = b.uploadedAt?.toMillis?.() || (b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0)
        return timeB - timeA
      })
      callback(docs)
    })
  })

  return () => unsubs.forEach((unsub) => unsub())
};

export const uploadDocument = async (uid, file, metadata, onProgress) => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const storagePath = `employees/${uid}/documents/${file.name}_${timestamp}`;
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      }, 
      (error) => reject(error), 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const docRef = await addDoc(collection(db, `documents/${uid}/files`), {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          storagePath: storagePath,
          downloadURL,
          uploadedAt: serverTimestamp(),
          description: metadata.description || '',
          category: metadata.category || 'other',
          uploadedBy: uid,
          employeeId: metadata.employeeId || uid,
          employeeEmail: metadata.employeeEmail || '',
          employeeName: metadata.employeeName || '',
        });
        resolve({ id: docRef.id, downloadURL });
      }
    );
  });
};

export const deleteDocument = async (uid, docId, storagePath) => {
  const docRef = doc(db, `documents/${uid}/files`, docId);
  await deleteDoc(docRef);
  if (storagePath) {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  }
};

export const uploadClientDeliverable = async (employeeUid, file, metadata, onProgress) => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const clientId = metadata.clientId || 'general';
    const storagePath = `deliverables/${clientId}/${file.name}_${timestamp}`;
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      }, 
      (error) => reject(error), 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const deliverableData = {
          filename: file.name,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          storagePath,
          downloadURL,
          fileUrl: downloadURL,
          uploadedAt: new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
          uploadedAtTimestamp: serverTimestamp(),
          description: metadata.description || '',
          category: metadata.category || 'Deliverable',
          clientId: metadata.clientId || '',
          clientEmail: metadata.clientEmail || '',
          clientName: metadata.clientName || '',
          projectId: metadata.projectId || '',
          projectName: metadata.projectName || '',
          uploadedBy: employeeUid,
        };

        const docRef = await addDoc(collection(db, 'deliverables'), deliverableData);
        await addDoc(collection(db, 'clientDocuments'), { id: docRef.id, ...deliverableData }).catch(() => {});
        resolve({ id: docRef.id, downloadURL });
      }
    );
  });
};

