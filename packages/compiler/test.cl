(macro defun (name args body) 
       `(def ,name (λ ,args ,body))
)

(defun foo (a) a)

(foo 5)
