import { useAuth } from "../auth/AuthContext";
import Lessons from "./Lessons";
import Manage from "./Manage";
import QuizBuilder from "./QuizBuilder";
import Users from "./Users";
import Parent from "./Parent";
import Games from "./Games";
import Certificates from "./Certificates";
import ClassPicker from "./ClassPicker";
import Notifications from "./Notifications";
import Assignments from "./Assignments";
export default function Dashboard() {
  const { profile } = useAuth();
  if (!profile) return null;
  const staff = profile.role === "admin" || profile.role === "teacher";
  return (<main className="wrap"><h2>أهلًا {profile.name}</h2>
    <Notifications />
    {profile.role === "student" && <ClassPicker />}
    {profile.role === "admin" && <Users />}
    {staff && <Manage isAdmin={profile.role === "admin"} />}
    {staff && <QuizBuilder />}
    {profile.role === "parent" ? <Parent /> : <><Lessons staff={staff} /><Assignments staff={staff} />{profile.role === "student" && <><Certificates /><Games /></>}</>}
  </main>);
}
